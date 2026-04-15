export const sanitizeCommentBody = (value: string): string =>
  value.replace(/[<>]/g, '').trim().slice(0, 1500);
