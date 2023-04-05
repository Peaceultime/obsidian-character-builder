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
					window.CharacterBuilderCache = Cache;
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
							await leaf.setViewState({ type: VIEW_TYPE_CHARACTER_BUILDER_FULL, active: true, state: { file: file.path } });
							this.app.workspace.revealLeaf(leaf);
						});
					});
				}
			})
		);

		this.registerEvent(this.app.vault.on("delete", file => {
			const tab = this.tabs.find(e => e.file && e.file === file);
			if(tab) tab.leaf.detach();
		}));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => this.app.workspace.saveLayout(), 5 * 60 * 1000));
	}

	async onunload() {
		console.clear();
	}

	async loadPluginData(): void {
		const data = await this.loadData();

		this.savedData = Object.assign({}, DEFAULT_SETTINGS, data);
		this.savedData.settings = Object.assign({}, DEFAULT_SETTINGS.settings, data.settings);
		this.settings = Cache.cache("settings", this.savedData.settings);
	}

	async savePluginData(): void {
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