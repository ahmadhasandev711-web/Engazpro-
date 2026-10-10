/**
 * كائن القيمة المركزي للمبالغ المالية والعملات (Money Value Object)
 * وفقاً للقاعدة الذهبية GR-1.1 في ARCHITECTURE_RULES.md
 * 
 * يتم تخزين المبالغ داخلياً كقروش صحيحة (Integer Cents) لتفادي أي أخطاء حسابية
 * ناتجة عن الفواصل العائمة (Floating Point Arithmetic) في جافاسكريبت.
 */
export class Money {
  protected readonly cents: number;
  protected readonly currency: string;

  constructor(amount: number | string = 0, currency: string = 'EGP') {
    const numeric = typeof amount === 'string' ? parseFloat(amount) || 0 : Number(amount) || 0;
    this.cents = Math.round(numeric * 100);
    this.currency = currency;
  }

  public static fromCents(cents: number, currency: string = 'EGP'): Money {
    const instance = new Money(0, currency);
    (instance as any).cents = Math.round(Number(cents) || 0);
    return instance;
  }

  public static of(amount: number | string = 0, currency: string = 'EGP'): Money {
    return new Money(amount, currency);
  }

  public static zero(currency: string = 'EGP'): Money {
    return new Money(0, currency);
  }

  public getAmount(): number {
    return Number((this.cents / 100).toFixed(2));
  }

  public getCents(): number {
    return this.cents;
  }

  public getCurrency(): string {
    return this.currency;
  }

  private extractCents(other: Money | number | string): number {
    if (other instanceof Money) {
      return other.getCents();
    }
    const numeric = typeof other === 'string' ? parseFloat(other) || 0 : Number(other) || 0;
    return Math.round(numeric * 100);
  }

  public add(other: Money | number | string): Money {
    const otherCents = this.extractCents(other);
    return Money.fromCents(this.cents + otherCents, this.currency);
  }

  public subtract(other: Money | number | string): Money {
    const otherCents = this.extractCents(other);
    return Money.fromCents(this.cents - otherCents, this.currency);
  }

  public multiply(multiplier: number | string): Money {
    const mult = typeof multiplier === 'string' ? parseFloat(multiplier) || 0 : Number(multiplier) || 0;
    return Money.fromCents(Math.round(this.cents * mult), this.currency);
  }

  public divide(divisor: number | string): Money {
    const div = typeof divisor === 'string' ? parseFloat(divisor) || 0 : Number(divisor) || 0;
    if (div === 0) {
      throw new Error('Cannot divide Money by zero');
    }
    return Money.fromCents(Math.round(this.cents / div), this.currency);
  }

  public isZero(): boolean {
    return this.cents === 0;
  }

  public isPositive(): boolean {
    return this.cents > 0;
  }

  public isNegative(): boolean {
    return this.cents < 0;
  }

  public equals(other: Money | number | string): boolean {
    return this.cents === this.extractCents(other);
  }

  public greaterThan(other: Money | number | string): boolean {
    return this.cents > this.extractCents(other);
  }

  public lessThan(other: Money | number | string): boolean {
    return this.cents < this.extractCents(other);
  }

  public greaterThanOrEqual(other: Money | number | string): boolean {
    return this.cents >= this.extractCents(other);
  }

  public lessThanOrEqual(other: Money | number | string): boolean {
    return this.cents <= this.extractCents(other);
  }

  public format(currencySymbol: string = 'ج.م'): string {
    const amount = this.getAmount();
    return `${amount.toLocaleString('ar-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`;
  }

  public toJSON(): number {
    return this.getAmount();
  }

  public toString(): string {
    return this.getAmount().toFixed(2);
  }
}
