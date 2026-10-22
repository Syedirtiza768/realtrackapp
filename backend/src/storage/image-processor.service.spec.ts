import sharp from 'sharp';
import { ImageProcessorService } from './image-processor.service.js';

jest.mock('sharp', () => jest.fn());

describe('ImageProcessorService.convertBufferToWebp', () => {
  const source = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const sharpFactory = sharp as unknown as jest.Mock;
  let pipeline: {
    metadata: jest.Mock;
    rotate: jest.Mock;
    resize: jest.Mock;
    webp: jest.Mock;
    toBuffer: jest.Mock;
  };
  let service: ImageProcessorService;

  beforeEach(() => {
    pipeline = {
      metadata: jest.fn().mockResolvedValue({ width: 4284, height: 4284 }),
      rotate: jest.fn(),
      resize: jest.fn(),
      webp: jest.fn(),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('webp')),
    };
    pipeline.rotate.mockReturnValue(pipeline);
    pipeline.resize.mockReturnValue(pipeline);
    pipeline.webp.mockReturnValue(pipeline);
    sharpFactory.mockReturnValue(pipeline);
    service = new ImageProcessorService({} as never);
  });

  it('keeps the standard pixel ceiling when no override is provided', async () => {
    await expect(service.convertBufferToWebp(source)).rejects.toThrow(
      'Image exceeds the maximum pixel count',
    );
    expect(pipeline.toBuffer).not.toHaveBeenCalled();
  });

  it('allows the bounded Fashion import cap while keeping WebP output settings', async () => {
    pipeline.metadata.mockResolvedValue({ width: 5712, height: 4284 });
    const result = await service.convertBufferToWebp(source, {
      maxPixelCount: 25_000_000,
    });

    expect(result).toEqual({
      buffer: Buffer.from('webp'),
      width: 5712,
      height: 4284,
    });
    expect(pipeline.resize).toHaveBeenCalledWith(2048, 2048, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    expect(pipeline.webp).toHaveBeenCalledWith({ quality: 85 });
  });
});