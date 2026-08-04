export function followOutputBehavior(atBottom: boolean): false | "auto" {
  return atBottom ? "auto" : false;
}

export function shouldAutoscrollOnHeightGrowth(atBottom: boolean): boolean {
  return atBottom;
}
