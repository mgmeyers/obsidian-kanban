/*
THIS IS A GENERATED/BUNDLED FILE BY ROLLUP
if you want to view the source visit the plugins github repository
*/

'use strict';

var obsidian = require('obsidian');

var IndexItemStyle;
(function (IndexItemStyle) {
    IndexItemStyle["List"] = "list";
    IndexItemStyle["Checkbox"] = "checkbox";
    IndexItemStyle["PureLink"] = "pureLink";
})(IndexItemStyle || (IndexItemStyle = {}));

const ZOOTTELKEEPER_INDEX_LIST_BEGINNING_TEXT = '%% Zoottelkeeper: Beginning of the autogenerated index file list  %%';
const ZOOTTELKEEPER_INDEX_LIST_END_TEXT = '%% Zoottelkeeper: End of the autogenerated index file list  %%';
const FRONTMATTER_SEPARATOR = '---';

const hasFrontmatter = (content) => {
    return (content.trim().startsWith(FRONTMATTER_SEPARATOR) && content.split(FRONTMATTER_SEPARATOR).length > 1);
};

const getFrontmatter = (content) => {
    return hasFrontmatter(content)
        ? `${FRONTMATTER_SEPARATOR}${content.split(FRONTMATTER_SEPARATOR)[1]}${FRONTMATTER_SEPARATOR}`
        : '';
};

const updateFrontmatter = (settings, currentContent) => {
    if (!settings.indexTagBoolean)
        return getFrontmatter(currentContent);
    let currentFrontmatterWithoutSep = `${currentContent.split(FRONTMATTER_SEPARATOR)[1]}`;
    if (currentFrontmatterWithoutSep === '')
        return '';
    else {
        let tagLine = currentFrontmatterWithoutSep.split('\n').find(elem => elem.split(':')[0] === settings.indexTagLabel);
        if (!tagLine && settings.indexTagValue && settings.indexTagBoolean) {
            tagLine = 'tags:';
            currentFrontmatterWithoutSep = `${currentFrontmatterWithoutSep}\n${tagLine}\n`;
        }
        const taglist = tagLine.split(':')[1];
        const indexTags = settings.indexTagSeparator
            ? settings.indexTagValue.split(settings.indexTagSeparator).map(tag => `[${tag}]`)
            : [`[${settings.indexTagValue}]`];
        let updatedTaglist = taglist;
        for (const indexTag of indexTags) {
            if (!taglist.includes(indexTag)) {
                updatedTaglist = !settings.indexTagSeparator
                    || (updatedTaglist.split(settings.indexTagSeparator).length >= 1
                        && updatedTaglist.split(settings.indexTagSeparator)[0] !== '')
                    ? `${updatedTaglist}${settings.indexTagSeparator}${indexTag}`
                    : indexTag;
            }
        }
        const updatedTagLine = `tags:${updatedTaglist}`;
        const regex = new RegExp(tagLine.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
        return settings.indexTagBoolean
            ? `${FRONTMATTER_SEPARATOR}${currentFrontmatterWithoutSep.replace(regex, updatedTagLine)}${FRONTMATTER_SEPARATOR}`
            : `${FRONTMATTER_SEPARATOR}${currentFrontmatterWithoutSep}${FRONTMATTER_SEPARATOR}`;
    }
};

const updateIndexContent = (currentContent, indexContent) => {
    const intro = currentContent.split(ZOOTTELKEEPER_INDEX_LIST_BEGINNING_TEXT)[0];
    const outro = currentContent.split(ZOOTTELKEEPER_INDEX_LIST_END_TEXT);
    const content = (currentContent === intro || currentContent === outro[0])
        ? `${ZOOTTELKEEPER_INDEX_LIST_BEGINNING_TEXT}\n${indexContent.join('\n')}\n${ZOOTTELKEEPER_INDEX_LIST_END_TEXT}\n`
        : `${intro}${ZOOTTELKEEPER_INDEX_LIST_BEGINNING_TEXT}\n${indexContent.join('\n')}\n${ZOOTTELKEEPER_INDEX_LIST_END_TEXT}${outro[1]}`;
    return content;
};

const removeFrontmatter = (content) => {
    return (content.startsWith(FRONTMATTER_SEPARATOR) && content.split(FRONTMATTER_SEPARATOR).length > 1)
        ? content.split(FRONTMATTER_SEPARATOR)[2]
        : content;
};

const DEFAULT_SETTINGS = {
    indexPrefix: '_Index_of_',
    indexItemStyle: IndexItemStyle.PureLink,
    indexTagValue: 'MOC',
    indexTagBoolean: true,
    indexTagSeparator: ', ',
    indexTagLabel: 'tags',
    cleanPathBoolean: true,
};

class ZoottelkeeperPlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        this.triggerUpdateIndexFile = obsidian.debounce(this.keepTheZooClean.bind(this), 3000, true);
        this.generateIndexContents = async (indexFile) => {
            let indexTFile = this.app.vault.getAbstractFileByPath(indexFile) ||
                (await this.app.vault.create(indexFile, '\n'));
            if (indexTFile && indexTFile instanceof obsidian.TFile)
                return this.generateIndexContent(indexTFile);
        };
        this.generateGeneralIndexContent = (options) => {
            return options.items
                .reduce((acc, curr) => {
                acc.push(options.func(curr.path));
                return acc;
            }, options.initValue);
        };
        this.generateIndexContent = async (indexTFile) => {
            let indexContent;
            // get subFolders
            //const subFolders = indexTFile.parent.children.filter(item => !this.isFile(item));
            //const files = indexTFile.parent.children.filter(item => this.isFile(item));
            const splitItems = indexTFile.parent.children.reduce((acc, curr) => {
                if (this.isFile(curr))
                    acc['files'].push(curr);
                else
                    acc['subFolders'].push(curr);
                return acc;
            }, { subFolders: [], files: [] });
            indexContent = this.generateGeneralIndexContent({
                items: splitItems.subFolders,
                func: this.generateIndexFolderItem,
                initValue: [],
            });
            indexContent = this.generateGeneralIndexContent({
                items: splitItems.files.filter(file => file.name !== indexTFile.name),
                func: this.generateIndexItem,
                initValue: indexContent,
            });
            try {
                if (indexTFile instanceof obsidian.TFile) {
                    let currentContent = await this.app.vault.cachedRead(indexTFile);
                    const updatedFrontmatter = hasFrontmatter(currentContent)
                        ? await updateFrontmatter(this.settings, currentContent)
                        : '';
                    currentContent = removeFrontmatter(currentContent);
                    const updatedIndexContent = await updateIndexContent(currentContent, indexContent);
                    await this.app.vault.modify(indexTFile, `${updatedFrontmatter}${updatedIndexContent}`);
                }
                else {
                    throw new Error('Creation index as folder is not supported');
                }
            }
            catch (e) {
                console.warn('Error during deletion/creation of index files', e);
            }
        };
        this.generateFormattedIndexItem = (path) => {
            switch (this.settings.indexItemStyle) {
                case IndexItemStyle.PureLink:
                    return `[[${path}]]`;
                case IndexItemStyle.List:
                    return `- [[${path}]]`;
                case IndexItemStyle.Checkbox:
                    return `- [ ] [[${path}]]`;
            }
        };
        this.generateIndexItem = (path) => {
            let internalFormattedIndex;
            if (this.settings.cleanPathBoolean) {
                const cleanPath = (path.endsWith(".md"))
                    ? path.replace(/\.md$/, '')
                    : path;
                const fileName = cleanPath.split("/").pop();
                internalFormattedIndex = `${cleanPath}|${fileName}`;
            }
            else {
                internalFormattedIndex = path;
            }
            return this.generateFormattedIndexItem(internalFormattedIndex);
        };
        this.generateIndexFolderItem = (path) => {
            return this.generateIndexItem(this.getInnerIndexFilePath(path));
        };
        this.getInnerIndexFilePath = (folderPath) => {
            const folderName = this.getFolderName(folderPath);
            return `${folderPath}/${this.settings.indexPrefix}${folderName}.md`;
        };
        this.getIndexFilePath = (filePath) => {
            const fileAbstrPath = this.app.vault.getAbstractFileByPath(filePath);
            if (this.isIndexFile(fileAbstrPath))
                return null;
            let parentPath = this.getParentFolder(filePath);
            // if its parent does not exits, then its a moved subfolder, so it should not be updated
            const parentTFolder = this.app.vault.getAbstractFileByPath(parentPath);
            if (parentPath && parentPath !== '') {
                if (!parentTFolder)
                    return undefined;
                parentPath = `${parentPath}/`;
            }
            const parentName = this.getParentFolderName(filePath);
            return `${parentPath}${this.settings.indexPrefix}${parentName}.md`;
        };
        this.getParentFolder = (filePath) => {
            const fileFolderArray = filePath.split('/');
            fileFolderArray.pop();
            return fileFolderArray.join('/');
        };
        this.getParentFolderName = (filePath) => {
            const parentFolder = this.getParentFolder(filePath);
            const fileFolderArray = parentFolder.split('/');
            return fileFolderArray[0] !== ''
                ? fileFolderArray[fileFolderArray.length - 1]
                : this.app.vault.getName();
        };
        this.getFolderName = (folderPath) => {
            const folderArray = folderPath.split('/');
            return (folderArray[0] !== '') ? folderArray[folderArray.length - 1] : this.app.vault.getName();
        };
        this.isIndexFile = (item) => {
            return this.isFile(item)
                && (this.settings.indexPrefix === ''
                    ? item.name === item.parent.name
                    : item.name.startsWith(this.settings.indexPrefix));
        };
        this.isFile = (item) => {
            return item instanceof obsidian.TFile;
        };
    }
    async onload() {
        await this.loadSettings();
        this.app.workspace.onLayoutReady(async () => {
            this.loadVault();
            console.debug(`Vault in files: ${JSON.stringify(this.app.vault.getMarkdownFiles().map((f) => f.path))}`);
        });
        this.registerEvent(this.app.vault.on('create', this.triggerUpdateIndexFile));
        this.registerEvent(this.app.vault.on('delete', this.triggerUpdateIndexFile));
        this.registerEvent(this.app.vault.on('rename', this.triggerUpdateIndexFile));
        this.addSettingTab(new ZoottelkeeperPluginSettingTab(this.app, this));
    }
    loadVault() {
        this.lastVault = new Set(this.app.vault.getMarkdownFiles().map((file) => file.path));
    }
    async keepTheZooClean() {
        console.debug('keeping the zoo clean...');
        if (this.lastVault) {
            const vaultFilePathsSet = new Set(this.app.vault.getMarkdownFiles().map((file) => file.path));
            try {
                // getting the changed files using symmetric diff
                let changedFiles = new Set([
                    ...Array.from(vaultFilePathsSet).filter((currentFile) => !this.lastVault.has(currentFile)),
                    ...Array.from(this.lastVault).filter((currentVaultFile) => !vaultFilePathsSet.has(currentVaultFile)),
                ]);
                console.debug(`changedFiles: ${JSON.stringify(Array.from(changedFiles))}`);
                // getting index files to be updated
                const indexFiles2BUpdated = new Set();
                for (const changedFile of Array.from(changedFiles)) {
                    const indexFilePath = this.getIndexFilePath(changedFile);
                    if (indexFilePath)
                        indexFiles2BUpdated.add(indexFilePath);
                    // getting the parents' index notes of each changed file in order to update their links as well (hierarhical backlinks)
                    const parentIndexFilePath = this.getIndexFilePath(this.getParentFolder(changedFile));
                    if (parentIndexFilePath)
                        indexFiles2BUpdated.add(parentIndexFilePath);
                }
                console.debug(`Index files to be updated: ${JSON.stringify(Array.from(indexFiles2BUpdated))}`);
                // update index files
                for (const indexFile of Array.from(indexFiles2BUpdated)) {
                    await this.generateIndexContents(indexFile);
                }
            }
            catch (e) { }
        }
        this.lastVault = new Set(this.app.vault.getMarkdownFiles().map((file) => file.path));
    }
    onunload() {
        console.debug('unloading plugin');
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
}
class ZoottelkeeperPluginSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        let { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Zoottelkeeper Settings' });
        containerEl.createEl('h3', { text: 'General Settings' });
        new obsidian.Setting(containerEl)
            .setName("Clean Files")
            .setDesc("This enables you to only show the files without path and '.md' ending in preview mode.")
            .addToggle((t) => {
            t.setValue(this.plugin.settings.cleanPathBoolean);
            t.onChange(async (v) => {
                this.plugin.settings.cleanPathBoolean = v;
                await this.plugin.saveSettings();
            });
        });
        new obsidian.Setting(containerEl)
            .setName('List Style')
            .setDesc('Select the style of the index-list.')
            .addDropdown(async (dropdown) => {
            dropdown.addOption(IndexItemStyle.PureLink, 'Pure Obsidian link');
            dropdown.addOption(IndexItemStyle.List, 'Listed link');
            dropdown.addOption(IndexItemStyle.Checkbox, 'Checkboxed link');
            dropdown.setValue(this.plugin.settings.indexItemStyle);
            dropdown.onChange(async (option) => {
                console.debug('Chosen index item style: ' + option);
                this.plugin.settings.indexItemStyle = option;
                await this.plugin.saveSettings();
            });
        });
        // index prefix
        new obsidian.Setting(containerEl)
            .setName('Index Prefix')
            .setDesc('Per default the file is named after your folder, but you can prefix it here.')
            .addText((text) => text
            .setPlaceholder('')
            .setValue(this.plugin.settings.indexPrefix)
            .onChange(async (value) => {
            console.debug('Index prefix: ' + value);
            this.plugin.settings.indexPrefix = value;
            await this.plugin.saveSettings();
        }));
        containerEl.createEl('h4', { text: 'Meta Tags' });
        // Enabling Meta Tags
        new obsidian.Setting(containerEl)
            .setName('Enable Meta Tags')
            .setDesc("You can add Meta Tags at the top of your index-file. This is useful when you're using the index files as MOCs.")
            .addToggle((t) => {
            t.setValue(this.plugin.settings.indexTagBoolean);
            t.onChange(async (v) => {
                this.plugin.settings.indexTagBoolean = v;
                await this.plugin.saveSettings();
            });
        });
        // setting the meta tag value
        const metaTagsSetting = new obsidian.Setting(containerEl)
            .setName('Set Meta Tags')
            .setDesc('You can add one or multiple tags to your index-files! There is no need to use "#", just use the exact value of the tags\' separator specified below between the tags.')
            .addText((text) => text
            .setPlaceholder('moc')
            .setValue(this.plugin.settings.indexTagValue)
            .onChange(async (value) => {
            this.plugin.settings.indexTagValue = value;
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName('Set the tag\'s label in frontmatter')
            .setDesc('Please specify the label of the tags in frontmatter (the text before the colon ):')
            .addText((text) => text
            .setPlaceholder('tags')
            .setValue(this.plugin.settings.indexTagLabel)
            .onChange(async (value) => {
            this.plugin.settings.indexTagLabel = value;
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName('Set the tag\'s separator in Frontmatter')
            .setDesc('Please specify the separator characters that distinguish the tags in Frontmatter:')
            .addText((text) => text
            .setPlaceholder(', ')
            .setValue(this.plugin.settings.indexTagSeparator)
            .onChange(async (value) => {
            this.plugin.settings.indexTagSeparator = value;
            await this.plugin.saveSettings();
        }));
    }
}

module.exports = ZoottelkeeperPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiaW50ZXJmYWNlcy9JbmRleEl0ZW1TdHlsZS50cyIsImNvbnN0cy50cyIsInV0aWxzL2hhc0Zyb250bWF0dGVyLnRzIiwidXRpbHMvZ2V0RnJvbnRtYXR0ZXIudHMiLCJ1dGlscy91cGRhdGVGcm9udG1hdHRlci50cyIsInV0aWxzL3VwZGF0ZUluZGV4Q29udGVudC50cyIsInV0aWxzL3JlbW92ZUZyb250bWF0dGVyLnRzIiwiZGVmYXVsdFNldHRpbmdzLnRzIiwibWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6bnVsbCwibmFtZXMiOlsiUGx1Z2luIiwiZGVib3VuY2UiLCJURmlsZSIsIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFDQSxJQUFZLGNBSVg7QUFKRCxXQUFZLGNBQWM7SUFDekIsK0JBQWEsQ0FBQTtJQUNiLHVDQUFxQixDQUFBO0lBQ3JCLHVDQUFtQixDQUFBO0FBQ3BCLENBQUMsRUFKVyxjQUFjLEtBQWQsY0FBYzs7QUNEbkIsTUFBTSx1Q0FBdUMsR0FBQyxzRUFBc0UsQ0FBQTtBQUNwSCxNQUFNLGlDQUFpQyxHQUFDLGdFQUFnRSxDQUFBO0FBQ3hHLE1BQU0scUJBQXFCLEdBQUMsS0FBSzs7QUNDakMsTUFBTSxjQUFjLEdBQUcsQ0FBQyxPQUFlO0lBQzFDLFFBQVEsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQ2pILENBQUM7O0FDRk0sTUFBTSxjQUFjLEdBQUcsQ0FBQyxPQUFlO0lBQzFDLE9BQU8sY0FBYyxDQUFDLE9BQU8sQ0FBQztVQUN4QixHQUFHLHFCQUFxQixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxxQkFBcUIsRUFBRTtVQUM1RixFQUFF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
