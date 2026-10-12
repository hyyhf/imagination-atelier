#!/usr/bin/env python3
"""Publish this exact repository using explicitly authorized local credentials.
The publisher never writes tokens; the official gh CLI manages its own credential store.
No force-push, security downgrade, or global permission changes.
Requires Python 3.10+ and Git. GitHub CLI is optional (recommended).
"""
from __future__ import annotations
import argparse, base64, getpass, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent.parent
OWNER_REPO = re.compile(r'^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')
EXCLUDED_DIRS = {'.git', 'node_modules', 'dist', '.venv', '__pycache__', '.artifacts'}
ALLOWED_TOP = {'.github', 'src', 'public', 'docs', 'scripts', 'qa', 'skills', 'prompts'}
ALLOWED_FILES = {'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'CONTRIBUTING.md',
                 'OPEN_FIRST.txt', 'START.html', 'index.html', 'package.json', 'package-lock.json',
                 'vite.config.ts', 'tsconfig.json', '.gitignore', '.gitattributes', '.nvmrc', 'MANIFEST.sha256',
                 'PUBLISH.command', 'PUBLISH.cmd'}
GENERATED = {'public/docs', 'public/skills', 'public/prompts', 'public/README.html',
             'public/build-info.json', 'public/downloads/portfolio-source.zip',
             'public/downloads/atelier-all-30.zip', 'public/downloads/portfolio-source.zip.sha256',
             'public/downloads/imagination-developer.zip', 'public/downloads/imagination-atelier-creative-kit.zip'}
SECRETS = re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----)')

class PublishError(RuntimeError): pass
class APIError(PublishError):
    def __init__(self, status: int, message: str, accepted: str = ''):
        self.status, self.accepted = status, accepted
        super().__init__(f'GitHub HTTP {status}: {message}' + (f' (Required permissions: {accepted})' if accepted else ''))

def run(args: list[str], *, cwd: Path | None = None, env: dict | None = None,
        timeout: int = 120, check: bool = True) -> subprocess.CompletedProcess:
    p = subprocess.run(args, cwd=cwd, env=env, text=True, encoding='utf-8', errors='replace',
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if check and p.returncode:
        # Never include subprocess environment or credential-bearing command arguments.
        text = (p.stderr or p.stdout).strip()
        raise PublishError(f'{Path(args[0]).name} failed ({p.returncode}): {text[:1800]}')
    return p

def source_files(root: Path = ROOT) -> list[Path]:
    result = []
    for p in root.rglob('*'):
        rel = p.relative_to(root)
        if not p.is_file() or p.is_symlink(): continue
        if any(part in EXCLUDED_DIRS for part in rel.parts): continue
        if p.name.startswith('.env') or p.name.endswith(('.pyc', '.tsbuildinfo')): continue
        if rel.parts[0] not in ALLOWED_TOP and rel.as_posix() not in ALLOWED_FILES: continue
        if any(rel.as_posix() == item or rel.as_posix().startswith(item + '/') for item in GENERATED): continue
        if p.stat().st_size >= 95 * 1024**2: raise PublishError(f'File exceeds safe Git size: {rel}')
        if p.suffix.lower() in {'.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.yml', '.yaml', '.txt', '.py', '.html', '.css'}:
            if SECRETS.search(p.read_bytes()): raise PublishError(f'Credential-like data detected; refusing upload: {rel}')
        result.append(p)
    return sorted(result, key=lambda p: p.relative_to(root).as_posix())

class GitHubAPI:
    def __init__(self, token: str = '', use_gh: bool = False):
        self.token, self.use_gh = token, use_gh
    def call(self, method: str, endpoint: str, body: dict | None = None):
        if self.use_gh:
            command = ['gh', 'api', '--hostname', 'github.com', '--method', method,
                       '-H', 'Accept: application/vnd.github+json',
                       '-H', 'X-GitHub-Api-Version: 2022-11-28', endpoint]
            if body is not None: command += ['--input', '-']
            p = subprocess.run(command, input=json.dumps(body) if body is not None else None,
                               capture_output=True, text=True, encoding='utf-8', timeout=90)
            if p.returncode:
                m = re.search(r'HTTP (\d{3})', p.stderr)
                status = int(m.group(1)) if m else 0
                try: message = json.loads(p.stdout).get('message', p.stderr.strip())
                except (ValueError, AttributeError): message = p.stderr.strip()
                raise APIError(status, str(message)[:1000])
            return json.loads(p.stdout) if p.stdout.strip() else None
        data = json.dumps(body).encode() if body is not None else None
        request = Request('https://api.github.com/' + endpoint.lstrip('/'), data=data, method=method,
                          headers={'Authorization': 'Bearer ' + self.token,
                                   'Accept': 'application/vnd.github+json',
                                   'X-GitHub-Api-Version': '2022-11-28',
                                   'Content-Type': 'application/json', 'User-Agent': 'Imagination-Atelier-Publisher'})
        try:
            with urlopen(request, timeout=90) as r:
                raw = r.read(); return json.loads(raw) if raw else None
        except HTTPError as e:
            raw = e.read()
            try: message = json.loads(raw).get('message', e.reason)
            except ValueError: message = str(e.reason)
            raise APIError(e.code, str(message), e.headers.get('X-Accepted-GitHub-Permissions', '')) from None
        except URLError as e: raise PublishError(f'Cannot connect to GitHub: {e.reason}') from None

def authenticate(args) -> GitHubAPI:
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if token: return GitHubAPI(token=token)
    gh = shutil.which('gh')
    if gh:
        auth = run(['gh','auth','status','--hostname','github.com'], check=False)
        if auth.returncode and args.login and not args.no_input:
            print('GitHub CLI will open its official authorization flow. Review requested access there.')
            p = subprocess.run(['gh','auth','login','--hostname','github.com','--web','--git-protocol','https','--scopes','workflow'])
            if p.returncode: raise PublishError('GitHub CLI authorization was not completed.')
            auth = run(['gh','auth','status','--hostname','github.com'], check=False)
        if not auth.returncode:
            # Older OAuth sessions may lack workflow scope. Fine-grained sessions use permission sets instead.
            scope_text = auth.stdout + auth.stderr
            if 'Token scopes:' in scope_text and "'workflow'" not in scope_text and args.login and not args.no_input:
                print('Workflow write access is required. GitHub CLI will request that scope.')
                p = subprocess.run(['gh','auth','refresh','--hostname','github.com','--scopes','workflow'])
                if p.returncode: raise PublishError('Workflow authorization was not granted.')
            return GitHubAPI(use_gh=True)
    if args.no_input:
        raise PublishError('No authenticated local GitHub CLI or GH_TOKEN. No remote changes were made. See docs/PUBLISH.md.')
    if not sys.stdin.isatty(): raise PublishError('Hidden token input requires a local interactive terminal. Use --no-input for unattended checks.')
    print('\nUse a fine-grained token for ONLY the target repository, with:')
    print('Contents / Workflows / Pages / Administration: Read and write; Actions: Read.')
    print('Create it at https://github.com/settings/personal-access-tokens/new')
    print('Paste it only into the hidden local prompt below. It will NOT be saved or committed.\n')
    token = getpass.getpass('Local GitHub token (hidden): ').strip()
    if not token: raise PublishError('No authorization supplied. No remote changes were made.')
    return GitHubAPI(token=token)

def check_repository(api, repo: str) -> dict:
    who = api.call('GET','user')
    metadata = api.call('GET',f'repos/{repo}')
    if not metadata.get('permissions',{}).get('admin'):
        raise PublishError('The authorized account must administer this repository to configure Pages.')
    if metadata.get('visibility') != 'public':
        raise PublishError('Repository is not public. This script never changes visibility implicitly.')
    if metadata.get('default_branch') != 'main':
        raise PublishError('Expected main as the default branch. Existing branches were not modified.')
    print(f'Authorized account: {who["login"]}; repository: {metadata["full_name"]} (public).')
    print('Repository role is NOT proof of token scopes; write operations below are authoritative checks.')
    metadata['_publisher'] = {'login': who['login'], 'id': who['id']}
    return metadata

def configure_pages(api, repo: str):
    try: page = api.call('GET',f'repos/{repo}/pages')
    except APIError as e:
        if e.status != 404: raise
        page = api.call('POST',f'repos/{repo}/pages',{'build_type':'workflow'})
    else:
        if page.get('build_type') != 'workflow':
            page = api.call('PUT',f'repos/{repo}/pages',{'build_type':'workflow'})
    # Enable Actions only if disabled; preserve any existing allowlist and repository protections.
    actions = api.call('GET',f'repos/{repo}/actions/permissions')
    if not actions.get('enabled'):
        policy=actions.get('allowed_actions')
        if policy not in ('all','local_only','selected'):
            raise PublishError('Actions is disabled and its existing policy was not returned. Configure it in the repository settings; no policy was guessed.')
        api.call('PUT',f'repos/{repo}/actions/permissions',{'enabled':True,'allowed_actions':policy})
    print('Pages configured for GitHub Actions. Existing Actions allowlists and protections preserved.')
    return page

def git_environment(api: GitHubAPI, temp: Path) -> dict:
    env = dict(os.environ); env['GIT_TERMINAL_PROMPT'] = '0'; env['GIT_CONFIG_COUNT']='1'
    env['GIT_CONFIG_KEY_0']='credential.helper'; env['GIT_CONFIG_VALUE_0']=''
    if api.use_gh:
        # Official CLI credential helper; no token extraction into application output.
        env['GIT_CONFIG_COUNT']='2';env['GIT_CONFIG_KEY_1']='credential.helper'
        env['GIT_CONFIG_VALUE_1']='!gh auth git-credential'
        return env
    helper = temp/'askpass.py'
    helper.write_text('import os,sys\nprint("x-access-token" if "username" in " ".join(sys.argv[1:]).lower() else os.environ["ATELIER_GIT_TOKEN"])\n',encoding='utf-8')
    if os.name == 'nt':
        launcher=temp/'askpass.cmd';launcher.write_text(f'@echo off\r\n"{sys.executable}" "{helper}" %*\r\n',encoding='utf-8')
    else:
        import shlex
        launcher=temp/'askpass.sh';launcher.write_text(f'#!/bin/sh\nexec {shlex.quote(sys.executable)} {shlex.quote(str(helper))} "$@"\n',encoding='utf-8');launcher.chmod(0o700)
    env['GIT_ASKPASS']=str(launcher);env['ATELIER_GIT_TOKEN']=api.token
    return env

def push_source(api, repo: str, files: list[Path], actor: dict) -> str:
    if not shutil.which('git'): raise PublishError('Git is required. Install from https://git-scm.com/downloads and rerun.')
    with tempfile.TemporaryDirectory(prefix='atelier-publish-') as name:
        temp=Path(name);checkout=temp/'repo';env=git_environment(api,temp)
        run(['git','clone','--depth','1','--single-branch','--branch','main',f'https://github.com/{repo}.git',str(checkout)],env=env,timeout=240)
        for p in files:
            dest=checkout/p.relative_to(ROOT);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
        run(['git','config','user.name',actor['login']],cwd=checkout)
        run(['git','config','user.email',f'{actor["id"]}+{actor["login"]}@users.noreply.github.com'],cwd=checkout)
        # Do not remove unrelated remote files. No force-push and no disabled branch protection.
        run(['git','add','--all'],cwd=checkout)
        changed=run(['git','diff','--cached','--quiet'],cwd=checkout,check=False).returncode
        if changed:
            run(['git','commit','-m','feat: publish complete 30-work atelier, MIT docs and verified Pages CI/CD'],cwd=checkout)
            run(['git','push','origin','HEAD:main'],cwd=checkout,env=env,timeout=300)
        sha=run(['git','rev-parse','HEAD'],cwd=checkout).stdout.strip()
    print(f'Source commit: {sha}')
    return sha

def wait_for_workflow(api, repo: str, sha: str, deadline_seconds: int):
    end=time.monotonic()+deadline_seconds;run_id=None;last=''
    while time.monotonic()<end:
        data=api.call('GET',f'repos/{repo}/actions/runs?head_sha={sha}&per_page=30')
        candidates=[r for r in data.get('workflow_runs',[]) if r.get('path','').split('@')[0]=='.github/workflows/pages.yml']
        if candidates:
            current=max(candidates,key=lambda r:r['id']);run_id=current['id']
            line=f'CI/CD: {current["status"]}; conclusion: {current.get("conclusion") or "pending"}'
            if line!=last:print(line,flush=True);last=line
            if current['status']=='completed':
                if current.get('conclusion')!='success':
                    jobs=api.call('GET',f'repos/{repo}/actions/runs/{run_id}/jobs')
                    failures=[j['name'] for j in jobs.get('jobs',[]) if j.get('conclusion') not in ('success','skipped')]
                    raise PublishError(f'CI/CD failed: {", ".join(failures)}. Inspect {current["html_url"]}. No successful deployment is claimed.')
                return current
        time.sleep(10)
    raise PublishError(f'No confirmed successful run within timeout. Inspect https://github.com/{repo}/actions . Rerun is safe.')

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo',default='hyyhf/imagination-atelier')
    parser.add_argument('--check-only',action='store_true',help='Read-only preflight; do not configure or push')
    parser.add_argument('--no-input',action='store_true',help='Never prompt or request new authorization')
    parser.add_argument('--login',action='store_true',help='Allow the official gh web authorization/refresh flow')
    parser.add_argument('--timeout',type=int,default=1200)
    args=parser.parse_args()
    if not OWNER_REPO.fullmatch(args.repo):parser.error('Expected owner/repository')
    try:
        run([sys.executable,str(ROOT/'scripts/check_source.py')],cwd=ROOT,timeout=120)
        files=source_files();print(f'Prepared {len(files)} reviewed files; no credentials included.')
        api=authenticate(args);metadata=check_repository(api,args.repo)
        if args.check_only:
            print('Read-only preflight finished. It does not verify token write permissions.');return 0
        configure_pages(api,args.repo)
        sha=push_source(api,args.repo,files,metadata['_publisher'])
        workflow=wait_for_workflow(api,args.repo,sha,args.timeout)
        page=api.call('GET',f'repos/{args.repo}/pages')
        url=page.get('html_url')
        if not url or not url.startswith('https://'):raise PublishError('GitHub did not return a valid HTTPS Pages URL.')
        from check_live import verify_live
        verification=verify_live(url,sha,attempts=8)
        result={'repository':args.repo,'sha':sha,'pages_url':url,'workflow_url':workflow['html_url'],'workflow_conclusion':'success','live_verification':verification}
        (ROOT/'.publish-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print('\nVERIFIED — source pushed, CI/CD passed, live revision and all 30 works checked.\n'+url)
        return 0
    except (PublishError, subprocess.TimeoutExpired, KeyboardInterrupt) as e:
        print(f'\nNOT DEPLOYED/NOT VERIFIED: {e}',file=sys.stderr)
        print('See docs/PUBLISH.md. Workflow contents: Workflows+Contents write. Pages setup: Pages+Administration write. Never paste tokens into chat.',file=sys.stderr)
        return 1
    except Exception as e:
        print(f'\nNOT VERIFIED: {type(e).__name__}: {e}',file=sys.stderr);return 1

if __name__=='__main__':raise SystemExit(main())
