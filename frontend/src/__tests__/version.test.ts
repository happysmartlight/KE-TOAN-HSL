import { APP_VERSION, APP_NAME } from '../version';

describe('version constants', () => {
  it('APP_NAME không rỗng', () => {
    expect(APP_NAME).toBeTruthy();
    expect(typeof APP_NAME).toBe('string');
  });

  it('APP_VERSION đúng format semver', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
