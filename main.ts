import { App, Editor, WorkspaceLeaf, Plugin } from 'obsidian';

import { CharacterBuilderCache as Cache, initCache } from 'src/cache.ts';
import { CharacterBuilderSettings as Settings, DEFAULT_SETTINGS, CharacterBuilderSettingTab as SettingTab } from 'src/settings.ts';
import { VIEW_TYPE_CHARACTER_BUILDER_FULL, CharacterBuilderFullView as FullView } from 'src/fullview.ts';

export default class CharacterBuilder extends Plugin {
	settings: Settings;
	tabs: CharacterBuilderFullView[];

	loading: Promise<void>;

	async onload(): void {
		this.tabs = [];
		await this.loadPluginData();
		if(!this.app.metadataCache.initialized)
		{
			this.loading = new Promise(function(res, rej) {
				this.app.metadataCache.on("resolved", async () => {
					this.app.metadataCache.off("resolved");
					await initCache(this.app);
					res();
				});
			}.bind(this));
		}
		else
		{
			this.loading = initCache(this.app);
		}

		this.registerView(
			VIEW_TYPE_CHARACTER_BUILDER_FULL,
			(leaf) => new FullView(leaf, this),
		);

		this.addRibbonIcon('calculator', 'Créer un nouveau personnage', async (evt: MouseEvent) => {
			const leaf = this.app.workspace.getLeaf();
			await leaf.setViewState({ type: VIEW_TYPE_CHARACTER_BUILDER_FULL, active: true, });
			this.app.workspace.revealLeaf(leaf);
		});

		this.addSettingTab(new SettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
				const metadata = this.app.metadataCache.getFileCache(file);
				if(metadata.hasOwnProperty("frontmatter") && metadata.frontmatter.type === "character")
				{
					menu.addSeparator().addItem(item => {
						item.setTitle("Modifier le personnage").setIcon("calculator").onClick(async () => {
							if(this.tabs.find(e => e.file === file))
								return new Notice("Ce personnage est déjà en cours d'edition");

							if(!leaf)
								leaf = this.app.workspace.getLeaf(true);
							await leaf.setViewState({ type: VIEW_TYPE_CHARACTER_BUILDER_FULL, active: true });
							leaf.view.openData(file);
							leaf.view.refresh(true);
							this.app.workspace.revealLeaf(leaf);
						});
					});
				}
			})
		);

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => this.savePluginData(), 5 * 60 * 1000));

		this.app.workspace.onLayoutReady(() => {
			const leaf = this.app.workspace.getLeaf(true);
			this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHARACTER_BUILDER_FULL);
			this.loadSavedViews();
			leaf.detach();
		});
	}

	async loadSavedViews() {
		await this.loading;
		if(!this.savedData || !this.savedData.views)
			return;

		for(let i = 0; i < this.savedData.views.length; i++)
		{
			const view = this.savedData.views[i];
			const file = this.app.vault.getAbstractFileByPath(view.path);
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.setViewState({ type: VIEW_TYPE_CHARACTER_BUILDER_FULL, active: view.active });
			if(file)
			{
				leaf.view.file = file;
			}
			leaf.view.metadata = view.metadata;
			leaf.view.refresh(true);
			this.app.workspace.revealLeaf(leaf);
		}
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHARACTER_BUILDER_FULL);
		console.clear();
	}

	async loadPluginData(): void {
		const data = await this.loadData();

		this.savedData = Object.assign({}, DEFAULT_SETTINGS, data);
		this.settings = Cache.cache("settings", this.savedData.settings);
	}

	async savePluginData(): void {
		this.savedData.views = (await this.app.workspace.getLeavesOfType(VIEW_TYPE_CHARACTER_BUILDER_FULL)).map(e => { return { metadata: e.view.metadata, path: e.view.file?.path, active: e === this.app.workspace.activeLeaf }; });
		this.savedData.settings = this.settings;
		await this.saveData(this.savedData);
		await initCache(this.app);
	}

	addTab(view: CharacterBuilderFullView): void {
		this.tabs.includes(view) || this.tabs.push(view);
	}

	removeTab(view: CharacterBuilderFullView): void {
		this.tabs.includes(view) && this.tabs.splice(this.tabs.findIndex(e => e === view), 1);
	}
}