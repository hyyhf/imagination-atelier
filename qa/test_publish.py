import importlib.util,os,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('publisher',ROOT/'scripts/publish.py');pub=importlib.util.module_from_spec(spec);spec.loader.exec_module(pub)
class Fake:
 def __init__(self,routes):self.routes=routes;self.calls=[]
 def call(self,method,path,body=None):
  self.calls.append((method,path,body));value=self.routes[(method,path)]
  if isinstance(value,Exception):raise value
  return value
class TestPublisher(unittest.TestCase):
 def test_no_auth_never_prompts(self):
  with patch.dict(os.environ,{},clear=True),patch.object(pub.shutil,'which',return_value=None),patch.object(pub.getpass,'getpass') as prompt:
   with self.assertRaises(pub.PublishError):pub.authenticate(SimpleNamespace(no_input=True,login=False))
   prompt.assert_not_called()
 def test_safety_allowlist(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'src').mkdir();(root/'src/App.tsx').write_text('export const a=1')
   (root/'src/.env').write_text('secret');(root/'node_modules').mkdir();(root/'node_modules/x').write_text('x')
   (root/'private.txt').write_text('not approved');(root/'LICENSE').write_text('MIT')
   self.assertEqual([p.relative_to(root).as_posix() for p in pub.source_files(root)],['LICENSE','src/App.tsx'])
 def test_source_upload_includes_required_entry_files(self):
  paths={p.relative_to(ROOT).as_posix() for p in pub.source_files(ROOT)}
  required={'index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json','src/App.tsx','src/main.tsx','.github/workflows/pages.yml','LICENSE'}
  self.assertTrue(required<=paths,sorted(required-paths))
  self.assertEqual(len([p for p in paths if p.startswith('public/works/') and p.endswith('/index.html')]),30)
 def test_generated_recursive_archive_is_not_uploaded(self):
  paths={p.relative_to(ROOT).as_posix() for p in pub.source_files(ROOT)}
  self.assertNotIn('public/downloads/portfolio-source.zip',paths)
  self.assertNotIn('public/downloads/atelier-all-30.zip',paths)
 def test_credential_scanner(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'src').mkdir();(root/'src/x.js').write_text('gh'+'p_'+'Z'*40)
   with self.assertRaises(pub.PublishError):pub.source_files(root)
 def test_askpass_contains_no_secret(self):
  with tempfile.TemporaryDirectory() as d:
   token='example-sensitive-value';env=pub.git_environment(pub.GitHubAPI(token=token),Path(d))
   self.assertEqual(env['ATELIER_GIT_TOKEN'],token)
   for p in Path(d).iterdir():self.assertNotIn(token,p.read_text())
 def test_public_repo_requires_admin(self):
  api=Fake({('GET','user'):{'login':'person','id':1},('GET','repos/a/b'):{'full_name':'a/b','visibility':'public','permissions':{'admin':False},'default_branch':'main'}})
  with self.assertRaises(pub.PublishError):pub.check_repository(api,'a/b')
 def test_does_not_make_repository_public(self):
  api=Fake({('GET','user'):{'login':'person','id':1},('GET','repos/a/b'):{'full_name':'a/b','visibility':'private','permissions':{'admin':True},'default_branch':'main'}})
  with self.assertRaises(pub.PublishError):pub.check_repository(api,'a/b')
  self.assertTrue(all(c[0]=='GET' for c in api.calls))
 def test_keeps_authenticated_author(self):
  api=Fake({('GET','user'):{'login':'person','id':9},('GET','repos/a/b'):{'full_name':'a/b','visibility':'public','permissions':{'admin':True},'default_branch':'main'}})
  self.assertEqual(pub.check_repository(api,'a/b')['_publisher'],{'login':'person','id':9})
 def test_existing_pages_no_changes(self):
  api=Fake({('GET','repos/a/b/pages'):{'build_type':'workflow','cname':'example.org'},('GET','repos/a/b/actions/permissions'):{'enabled':True,'allowed_actions':'selected'}})
  pub.configure_pages(api,'a/b');self.assertTrue(all(x[0]=='GET' for x in api.calls))
 def test_enabling_preserves_allowlist(self):
  api=Fake({('GET','repos/a/b/pages'):{'build_type':'workflow'},('GET','repos/a/b/actions/permissions'):{'enabled':False,'allowed_actions':'selected'},('PUT','repos/a/b/actions/permissions'):None})
  pub.configure_pages(api,'a/b');self.assertEqual(api.calls[-1],('PUT','repos/a/b/actions/permissions',{'enabled':True,'allowed_actions':'selected'}))
 def test_missing_actions_policy_is_not_broadened(self):
  api=Fake({('GET','repos/a/b/pages'):{'build_type':'workflow'},('GET','repos/a/b/actions/permissions'):{'enabled':False}})
  with self.assertRaises(pub.PublishError):pub.configure_pages(api,'a/b')
  self.assertTrue(all(x[0]=='GET' for x in api.calls))
 def test_create_pages_once(self):
  api=Fake({('GET','repos/a/b/pages'):pub.APIError(404,'not enabled'),('POST','repos/a/b/pages'):{'build_type':'workflow'},('GET','repos/a/b/actions/permissions'):{'enabled':True}})
  pub.configure_pages(api,'a/b');self.assertEqual(api.calls[1],('POST','repos/a/b/pages',{'build_type':'workflow'}))
 def test_pages_denial_stops(self):
  api=Fake({('GET','repos/a/b/pages'):pub.APIError(403,'denied')})
  with self.assertRaises(pub.APIError):pub.configure_pages(api,'a/b')
  self.assertEqual(len(api.calls),1)
 def test_migrate_only_build_type(self):
  api=Fake({('GET','repos/a/b/pages'):{'build_type':'legacy','cname':'example.org'},('PUT','repos/a/b/pages'):{'build_type':'workflow'},('GET','repos/a/b/actions/permissions'):{'enabled':True}})
  pub.configure_pages(api,'a/b');self.assertEqual(api.calls[1][2],{'build_type':'workflow'})
 def test_workflow_failure_not_success(self):
  api=Fake({('GET','repos/a/b/actions/runs?head_sha=abc&per_page=30'):{'workflow_runs':[{'id':1,'path':'.github/workflows/pages.yml','status':'completed','conclusion':'failure','html_url':'https://github.com/a/b/actions/runs/1'}]},('GET','repos/a/b/actions/runs/1/jobs'):{'jobs':[{'name':'build','conclusion':'failure'}]}})
  with self.assertRaises(pub.PublishError):pub.wait_for_workflow(api,'a/b','abc',10)
 def test_no_force_push_code(self):
  source=(ROOT/'scripts/publish.py').read_text()
  self.assertNotIn("['git','push','--force'",source)
  self.assertNotIn("'force':True",source)
if __name__=='__main__':unittest.main()
