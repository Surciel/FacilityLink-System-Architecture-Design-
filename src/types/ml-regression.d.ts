declare module 'ml-regression' {
  export class PolynomialRegression {
    constructor(x: number[], y: number[], degree: number);
    predict(x: number): number;
    toString(precision?: number): string;
  }

  export class SimpleLinearRegression {
    constructor(x: number[], y: number[]);
    predict(x: number): number;
    slope: number;
    intercept: number;
  }
}