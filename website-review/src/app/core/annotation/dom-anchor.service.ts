import { Injectable } from '@angular/core';
import { CommentAnchor, DomRectAnchor } from '../models/review.models';

@Injectable({ providedIn: 'root' })
export class DomAnchorService {
  buildAnchor(element: HTMLElement): CommentAnchor {
    const rect = element.getBoundingClientRect();
    return {
      cssPath: this.buildCssPath(element),
      textSnippet: (element.textContent ?? '').trim().slice(0, 120),
      rect: this.normalizeRect(rect),
    };
  }

  resolveAnchor(doc: Document, anchor: CommentAnchor): HTMLElement | null {
    if (!anchor.cssPath) {
      return null;
    }

    const firstMatch = doc.querySelector(anchor.cssPath);
    if (firstMatch instanceof HTMLElement) {
      return firstMatch;
    }

    if (!anchor.textSnippet) {
      return null;
    }

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
    let current = walker.nextNode();
    while (current) {
      if (
        current instanceof HTMLElement &&
        (current.textContent ?? '').includes(anchor.textSnippet)
      ) {
        return current;
      }
      current = walker.nextNode();
    }

    return null;
  }

  private normalizeRect(rect: DOMRect): DomRectAnchor {
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }

  private buildCssPath(element: HTMLElement): string {
    const segments: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current.tagName.toLowerCase() !== 'body') {
      const tag = current.tagName.toLowerCase();
      const className = (current.className ?? '')
        .toString()
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 1)
        .join('');

      const siblings = Array.from(current.parentElement?.children ?? []).filter(
        (sibling) => sibling.tagName === current?.tagName,
      );
      const index = siblings.indexOf(current) + 1;
      const escapedClassName = this.escapeCss(className);
      const classSelector = escapedClassName ? `.${escapedClassName}` : '';
      segments.unshift(`${tag}${classSelector}:nth-of-type(${index})`);
      current = current.parentElement;
    }

    return `body > ${segments.join(' > ')}`;
  }

  private escapeCss(value: string): string {
    const css = globalThis.CSS as { escape?: (input: string) => string } | undefined;
    if (css?.escape) {
      return css.escape(value);
    }
    return value.replace(/[^a-zA-Z0-9_-]/g, '');
  }
}
