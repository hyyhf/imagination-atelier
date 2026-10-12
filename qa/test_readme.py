import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'scripts'))
from render_readme import inline,render,document
class TestReadme(unittest.TestCase):
 def test_code_link(self):self.assertEqual(inline('[`START.html`](START.html)'),'<a href="START.html"><code>START.html</code></a>')
 def test_code_is_not_executed(self):self.assertIn('&lt;script&gt;',render('```html\n<script>\n```'))
 def test_gallery_line_break_and_literal_code(self):
  self.assertEqual(inline('作品说明<br>'), '作品说明<br>')
  self.assertEqual(inline('`<br>`'), '<code>&lt;br&gt;</code>')
 def test_heading_anchor_and_table(self):
  self.assertIn('id="安装-skill"',render('## 安装 Skill'))
  self.assertIn('<th>A</th>',render('| A | B |\n|---|---|\n| one | two |'))
 def test_authored_gallery_is_preserved(self):
  self.assertIn('<img src="picture.png">',render('<table>\n<tr><td><img src="picture.png"></td></tr>\n</table>'))
 def test_complete_readme_renders(self):
  p=Path(__file__).resolve().parent.parent/'README.md';result=document(p.read_text())
  self.assertIn('src="docs/screenshots/11-popup.jpg"',result)
  self.assertNotIn('\x00',result)
if __name__=='__main__':unittest.main()
