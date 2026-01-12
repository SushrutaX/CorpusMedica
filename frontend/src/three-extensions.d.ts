declare module "three/examples/jsm/controls/OrbitControls" {
  export const OrbitControls: new (...args: any[]) => any;
}

declare module "three/examples/jsm/loaders/PLYLoader" {
  export const PLYLoader: new () => {
    parse: (data: ArrayBuffer) => any;
  };
}
