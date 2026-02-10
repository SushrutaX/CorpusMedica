declare module "three/examples/jsm/controls/OrbitControls" {
  export const OrbitControls: new (...args: any[]) => any;
}

declare module "three/examples/jsm/loaders/PLYLoader" {
  export const PLYLoader: new () => {
    parse: (data: ArrayBuffer) => any;
  };
}

declare module "three/examples/jsm/loaders/GLTFLoader" {
  export class GLTFLoader {
    load: (
      url: string,
      onLoad: (gltf: any) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: unknown) => void
    ) => void;
  }
}
