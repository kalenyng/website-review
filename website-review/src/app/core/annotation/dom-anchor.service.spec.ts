import { DomAnchorService } from './dom-anchor.service';

describe('DomAnchorService', () => {
  let service: DomAnchorService;

  beforeEach(() => {
    service = new DomAnchorService();
    document.body.innerHTML = `
      <main>
        <button class="cta">Request review</button>
        <p>Some supporting text</p>
      </main>
    `;
  });

  it('builds and resolves anchors from a target element', () => {
    const button = document.querySelector('.cta') as HTMLElement;
    const anchor = service.buildAnchor(button);
    const restored = service.resolveAnchor(document, anchor);

    expect(anchor.cssPath).toContain('button');
    expect(anchor.textSnippet).toContain('Request review');
    expect(restored).toBe(button);
  });

  it('uses text fallback when css path does not resolve', () => {
    const anchor = {
      cssPath: 'body > main > div:nth-of-type(9)',
      textSnippet: 'Some supporting text',
      rect: { x: 0, y: 0, width: 10, height: 10 },
    };
    const restored = service.resolveAnchor(document, anchor);
    expect(restored?.textContent).toContain('Some supporting text');
  });
});
