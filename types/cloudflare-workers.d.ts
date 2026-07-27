declare module "cloudflare:workers" {
  // The runtime injects the concrete binding shape from .openai/hosting.json.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const env: any;
}
