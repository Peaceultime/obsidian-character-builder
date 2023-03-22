import { VisualComponent } from 'src/components.ts';

export class Tab {
	container: TabContainer;
	options: any;
	title: string;
	requiredList: VisualComponent[];
	content: HTMLDivElement;
	breadcrumb: HTMLSpanElement;
	cb: (idx: number, title: string) => void;
	dirty: boolean = true;
	constructor(container: TabContainer, title: string) {
		this.container = container;
		this.title = title;
		this.requiredList = [];

		this.content = container.container.createDiv({ cls: ["character-builder-tab", "tab-hidden"] });
		this.breadcrumb = container.breadcrumb.createDiv({ cls: ["character-builder-breadcrumb-tab", "tab-hidden"] }).createSpan({ text: title, cls: "character-builder-breadcrumb-tab-title" });
	}
	required(fields: VisualComponent | VisualComponent[]): Tab {
		if(!Array.isArray(fields))
			fields = [fields];

		for(let i = 0; i < fields.length; i++)
		{
			if(!this.requiredList.includes(fields[i]))
				this.requiredList.push(fields[i]);
		}

		return this;
	}
	check(): boolean {
		return this.requiredList.map(e => e.validate()).every(e => !!e);
	}
	show(): void {
		if(this.dirty)
		{
			this.render();
			this.dirty = false;
		}

		this.breadcrumb.parentElement.classList.remove("tab-hidden");
		this.content.classList.remove("tab-hidden");
		this.content.querySelectorAll(".invalid").forEach(e => e.classList.remove("invalid"));
		this.cb && this.cb(this);
	}
	hide(): void {
		this.breadcrumb.parentElement.classList.add("tab-hidden");
		this.content.classList.add("tab-hidden");
	}
	onOpen(cb: (tab: Tab) => void): Tab {
		this.cb = cb;

		return this;
	}
	request(property: string): any {
		if(this.container.dataCache && this.container.dataCache.hasOwnProperty(property))
			return this.container.dataCache[property];
	}
	abstract render();
}
export class TabContainer {
	app: App;

	breadcrumb: HTMLDivElement;
	container: HTMLDivElement;
	tabs: Tab[];
	active: number;

	dataCache: any;
	constructor(app: App, elmt: HTMLElement, header?: HTMLElement) {
		this.app = app;
		this.breadcrumb = !!header ? header.createDiv({ cls: "character-builder-breadcrumb-container" }) : elmt.createDiv({ cls: "character-builder-breadcrumb-container" });
		this.container = elmt.createDiv({ cls: "character-builder-tab-container" });
		this.tabs = [];
		this.active = 0;
	}
	get(type: T): T {
		for(let i = 0; i < this.tabs.length; i++)
		{
			if(this.tabs[i] instanceof type)
				return this.tabs[i];
		}
		return undefined;
	}
	add(type: T, options: any): T {
		if(type === undefined)
			type = Tab;
		const tab = new type(this, options);
		const idx = this.tabs.push(tab) - 1;

		tab.breadcrumb.addEventListener("click", () => this.goto(idx));

		if(idx === 0)
			tab.show();

		return tab;
	}
	/*remove(tab: string | number): boolean {
		let idx;
		if(tab instanceof string)
		{
			idx = tabs.findIndex(e => e.title === tab);

			if(idx === -1)
				return false;
		}
		else
			idx = tab;

		this.tabs;
		//TODO
		return false;
	}*/
	goto(idx: number): boolean {
		if(idx < 0 || idx >= this.tabs.length)
			return false;

		if(idx > this.active && !this.tabs[this.active].check())
			return false;

		this.tabs[this.active].hide();
		this.tabs[idx].show();

		this.active = idx;

		return true;
	}
	next(): boolean {
		return this.goto(this.active + 1);
	}
	previous(): boolean {
		return this.goto(this.active - 1);
	}
	render(force: boolean): void {
		const tab = this.tabs[this.active];
		if(tab.dirty || force)
			tab.render();
	}

	cache(data: any): TabContainer
	{
		this.dataCache = data;
		return this;
	}
}