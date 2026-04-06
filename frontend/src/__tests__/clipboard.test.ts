/**
 * Tests cho copyToClipboard utility
 * Chạy trong jsdom environment.
 */
import { copyToClipboard } from '../utils/clipboard';

describe('copyToClipboard()', () => {
  describe('Fallback (execCommand) — khi không có navigator.clipboard', () => {
    beforeEach(() => {
      // Xóa clipboard API để kích hoạt execCommand fallback
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      // Mock execCommand để trả về true (thành công)
      document.execCommand = vi.fn().mockReturnValue(true);
    });

    it('resolve khi execCommand thành công', async () => {
      await expect(copyToClipboard('hello world')).resolves.toBeUndefined();
      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    it('reject khi execCommand thất bại', async () => {
      document.execCommand = vi.fn().mockReturnValue(false);

      await expect(copyToClipboard('hello')).rejects.toThrow(
        'Copy không được hỗ trợ trên trình duyệt này'
      );
    });

    it('tạo và xóa textarea khỏi DOM sau khi copy', async () => {
      document.execCommand = vi.fn().mockReturnValue(true);
      const initialCount = document.body.childElementCount;

      await copyToClipboard('test text');

      // Textarea phải được dọn sạch
      expect(document.body.childElementCount).toBe(initialCount);
    });
  });

  describe('navigator.clipboard API — khi có secure context', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        writable: true,
        configurable: true,
      });
    });

    it('gọi navigator.clipboard.writeText', async () => {
      await copyToClipboard('secure text');
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('secure text');
    });
  });
});
