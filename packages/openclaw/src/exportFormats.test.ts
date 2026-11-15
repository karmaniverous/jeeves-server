import { describe, expect, it } from 'vitest';

import { exportFormatsFor } from './exportFormats.js';

describe('exportFormatsFor', () => {
  it.each([
    ['j/A.MD', false, ['pdf', 'docx']],
    ['j/d.PlantUML', false, ['svg', 'png']],
    ['j/v1.2/readme', false, []],
    ['j/v1.2/notes.md', true, ['zip', 'tar']],
    ['j/diagram.pu', false, []],
  ])('%s (directory: %s) -> %j', (path, isDirectory, formats) => {
    expect(exportFormatsFor(path, isDirectory)).toEqual(formats);
  });
});
