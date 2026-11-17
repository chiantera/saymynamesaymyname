"""Local fixture-only accessibility checks; never navigate to hosted accounts."""
from pathlib import Path


def audit_ui(page, label):
    # Audit the settled UI, not an intermediate color during a theme/nav transition.
    # Await real font/animation readiness rather than sleeping or disabling motion.
    page.evaluate("""async () => {
      await document.fonts.ready;
      await new Promise(requestAnimationFrame);
      await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})));
    }""")
    source = Path(__file__).resolve().parents[2] / 'frontend/node_modules/axe-core/axe.min.js'
    # Test instrumentation via DevTools, not an inline script in the app DOM.
    # Keep production CSP enforced; do not enable bypass_csp for accessibility.
    page.evaluate(source.read_text(encoding='utf-8'))
    violations = page.evaluate("""async () => {
      const result = await axe.run(document, {
        runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21aa']}
      });
      return result.violations.map(v => ({id:v.id, targets:v.nodes.map(n=>n.target)}));
    }""")
    assert not violations, (label, violations)
