import { Modal, Setting } from 'obsidian';

export interface ConfirmModalOptions
{
	yesText: string;
	noText: string;

	title?: string;
	content: string;
}
class ConfirmModal extends Modal
{
	yesCb: () => void;
	noCb: () => void;
	constructor(app: App, options: ConfirmModalOptions)
	{
		super(app);

		let { contentEl } = this;
		(new Setting(contentEl)).setName(options.content);

		if(options.title)
			this.titleEl.textContent = options.title;

		(new Setting(contentEl)).addButton(btn => btn.setButtonText(options.yesText).onClick(() => {
			this.yesCb && this.yesCb();
			this.close();
		})).addButton(btn => btn.setButtonText(options.noText).onClick(() => {
			this.noCb && this.noCb();
			this.close();
		}))
	}
	onYesPressed(cb): void
	{
		this.yesCb = cb;
	}
	onNoPressed(cb): void
	{
		this.noCb = cb;
	}
	onClose(): void
	{
		try {
			this.noCb && this.noCb();
		} catch(e) {}
	}
}
export function confirm(app: App, options: ConfirmModalOptions)
{
	return new Promise((res, rej) => {
		const modal = new ConfirmModal(app, options);
		modal.onYesPressed(res);
		modal.onNoPressed(rej);
		modal.open();
	});
}