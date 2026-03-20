declare module '@mediapipe/tasks-vision' {
  export class FilesetResolver {
    static forVisionTasks(wasmPath: string): Promise<any>;
  }
  export class FaceDetector {
    static createFromOptions(vision: any, options: any): Promise<FaceDetector>;
    detectForVideo(video: HTMLVideoElement, timestamp: number): {
      detections: Array<{
        boundingBox: { originX: number; originY: number; width: number; height: number };
      }>;
    };
    close(): void;
  }
}
