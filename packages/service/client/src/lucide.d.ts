// lucide 1.x ships without declaration files. Minimal shim for the
// icons and helpers used by this project.
declare module 'lucide' {
  type IconNode = [string, Record<string, string>, IconNode[]?][];

  export function createElement(
    iconNode: IconNode,
    attrs?: Record<string, string | number>,
  ): SVGSVGElement;

  export const Copy: IconNode;
  export const Check: IconNode;
  export const Maximize: IconNode;
  export const Minimize: IconNode;
}
