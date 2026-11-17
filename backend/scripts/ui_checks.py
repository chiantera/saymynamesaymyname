"""Local fixture-only accessibility checks; never navigate to hosted accounts."""
from pathlib import Path


def audit_ui(page, label):
    source = Path(__file__).resolve().parents[2] / 'frontend/node_modules/axe-core/axe.min.js'
    page.add_script_tag(content=source.read_text(encoding='utf-8'))
    violations = page.evaluate("""async () => {
      const result = await axe.run(document, {
        runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21aa']}
      });
      return result.violations.map(v => ({id:v.id, targets:v.nodes.map(n=>n.target)}));
    }""")
    assert not violations, (label, violations)
