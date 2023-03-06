export class HTMLStatElement {
	min: number;
	max: number;
	val: number;
	component: HTMLElement;
	cb: (oldVal: number, newVal: number) => void;
	constructor(parent: HTMLElement, min?: number, max?: number, step: number = 1)
	{
		this.min = min;
		this.max = max;
		this.component = parent.createEl("input", { type: "number", cls: "character-builder-stat-input", attr: { min: min, max: max, step: step } });
		this.component.addEventListener("change", this._onChange.bind(this));
	}
	value(value: number): HTMLStatElement
	{
		this.component.valueAsNumber = value;
		this._onChange();
		return this;
	}
	change(cb: (oldVal: number, newVal: number) => void): HTMLStatElement
	{
		this.cb = cb;
		return this;
	}
	private _onChange(): void
	{
		//CHECKING VALIDITY
		let value = parseInt(this.component.valueAsNumber);
		if(isNaN(value) || value === "" || value === undefined)
			value = parseInt(this.component.attributes["min"].value) || 0;
		if(this.component.validity.rangeOverflow)
			value = parseInt(this.component.attributes["max"].value) || 0;
		else if(this.component.validity.rangeUnderflow)
			value = parseInt(this.component.attributes["min"].value) || 0;
		else if(this.component.validity.stepMismatch)
			value -= value % parseInt(this.component.attributes["step"].value) || 1;
		this.component.valueAsNumber = value;

		//SENDING CALLBACK
		const oldVal = this.val;
		this.val = value;
		if(this.cb)
		{
			const returned = this.cb(oldVal, value);
			if(returned === false)
			{
				this.val = oldVal;
				this.component.valueAsNumber = oldVal;
			}
			else if(returned !== undefined)
			{
				this.val = returned;
				this.component.valueAsNumber = returned;
			}
		}
	}
}
