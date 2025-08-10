declare global {
  interface Notice { }
  interface Window {
    moment?: any;
    Notice: new (message: string, duration?: number) => Notice;
  }
}
export { };
