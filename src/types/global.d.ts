declare global {
  interface Notice {
    show: () => void;
    hide: () => void
  }
  interface Window {
    moment?: import('moment').Moment;
    Notice: new (message: string, duration?: number) => Notice;
  }
}
export { };
