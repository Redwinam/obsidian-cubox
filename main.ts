import { Plugin, TFile, Notice, PluginSettingTab, App, Setting, PluginManifest, requestUrl, moment } from "obsidian";

interface CuboxPluginSettings {
  apiKey: string;
  defaultTags: string;
  defaultFolder: string;
}

const DEFAULT_SETTINGS: CuboxPluginSettings = {
  apiKey: "",
  defaultTags: "Obsidian",
  defaultFolder: "",
};

interface CuboxSaveMemoParams {
  type: string;
  content: string;
  title: string;
  description: string;
  tags: string[] | undefined;
  folder: string | undefined;
}

interface CuboxSaveMemoResponse {
  success: boolean;
  error?: string;
}

interface Translation {
  shareToCubox: string;
  noActiveFile: string;
  enterApiKey: string;
  setting: string;
  settings: {
    apiKey: string;
    defaultTags: string;
    defaultFolder: string;
  };
  settingDescriptions: {
    apiKey: string;
    defaultTags: string;
    defaultFolder: string;
  };
  settingPlaceHolders: {
    apiKey: string;
    defaultTags: string;
    defaultFolder: string;
  };
  success: string;
  failure: string;
}

const translations: { [key: string]: Translation } = {
  en: {
    shareToCubox: "Share to Cubox",
    noActiveFile: "No active file to share.",
    enterApiKey: "Please enter your Cubox API key in the plugin settings.",
    setting: "Share to Cubox Settings",
    settings: {
      apiKey: "Cubox API Key",
      defaultTags: "Default Tags (comma-separated)",
      defaultFolder: "Default Folder",
    },
    settingDescriptions: {
      apiKey: "Enter your Cubox API Key (found in the API settings on the Cubox website)",
      defaultTags: "Enter your default tags separated by commas (e.g., tag1, tag2, tag3)",
      defaultFolder: "Enter your default folder name",
    },
    settingPlaceHolders: {
      apiKey: "Enter your Cubox API Key",
      defaultTags: "Enter your default tags here",
      defaultFolder: "Enter your default folder name here",
    },
    success: "Successfully shared to Cubox.",
    failure: "Failed to share to Cubox:",
  },
  zh: {
    shareToCubox: "分享到 Cubox",
    noActiveFile: "没有要分享的活动文件。",
    enterApiKey: "请在插件设置中输入您的 Cubox API 密钥。",
    setting: "Share to Cubox 设置",
    settings: {
      apiKey: "Cubox API 密钥",
      defaultTags: "默认标签",
      defaultFolder: "默认文件夹",
    },
    settingDescriptions: {
      apiKey: "输入您的 Cubox API 密钥（在 Cubox 网站的 API 设置中）",
      defaultTags: "输入您的默认标签，用逗号分隔（例如，tag1，tag2，tag3）",
      defaultFolder: "输入您的默认文件夹名称",
    },
    settingPlaceHolders: {
      apiKey: "输入您的 Cubox API 密钥",
      defaultTags: "在此输入您的默认标签",
      defaultFolder: "在此输入您的默认文件夹名称",
    },
    success: "成功分享到 Cubox。",
    failure: "分享到 Cubox 失败：",
  },
};

class CuboxApi {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async saveMemo(params: CuboxSaveMemoParams): Promise<CuboxSaveMemoResponse> {
    try {
      if ((params as any).tags === undefined) {
        delete (params as any).tags;
      }
      
      if ((params as any).folder === undefined) {
        delete (params as any).folder;
      }

      const response = await requestUrl({
        url: `https://cubox.pro/c/api/save/${this.apiKey}`,
        method: "POST",
        body: JSON.stringify(params),
        headers: {
          "Content-Type": "application/json",
        },
      });
  
      const responseBody = await response.json;
  
      if (responseBody.code === 200) {
        return { success: true };
      } else {
        return { success: false, error: responseBody.message || "Unknown error" };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export default class CuboxPlugin extends Plugin {
  settings: CuboxPluginSettings;
  translation: Translation;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.settings = DEFAULT_SETTINGS;

    const language = moment.locale();
    this.translation = translations[language.startsWith("zh") ? "zh" : "en"];
  }


  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "share-this",
      name: this.translation.shareToCubox,
      callback: () => this.shareToCubox(),
    });

    this.addRibbonIcon("share", this.translation.shareToCubox, () => {
      this.shareToCubox();
    });

    this.addSettingTab(new CuboxSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async shareToCubox() {
    if (!this.settings.apiKey) {
      new Notice(this.translation.enterApiKey);
      return;
    }

    const activeFile: TFile | null = this.app.workspace.getActiveFile();
  
    if (!activeFile) {
      new Notice(this.translation.noActiveFile);
      return;
    }
  
    const fileContent: string = await this.app.vault.read(activeFile);

    const cuboxApi = new CuboxApi(this.settings.apiKey);
    const title = activeFile.basename;
    const description = fileContent;
    const tags =
    this.settings.defaultTags !== ""
      ? this.settings.defaultTags.split(",").map((tag) => tag.trim())
      : undefined;
    const folder = this.settings.defaultFolder || undefined;

    const response = await cuboxApi.saveMemo({
      type: "memo",
      content: fileContent,
      title,
      description,
      tags,
      folder,
    });
  
    if (response.success) {
      new Notice(this.translation.success);
    } else {
      new Notice(this.translation.failure + response.error);
    }
  }
}

class CuboxSettingTab extends PluginSettingTab {
  plugin: CuboxPlugin;

  constructor(app: App, plugin: CuboxPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;
    containerEl.empty();
    
    new Setting(containerEl)
      .setName(this.plugin.translation.settings.apiKey)
      .setDesc(this.plugin.translation.settingDescriptions.apiKey)
      .addText((text) =>
        text
          .setPlaceholder(this.plugin.translation.settingPlaceHolders.apiKey)
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          })
      );
  
    new Setting(containerEl)
      .setName(this.plugin.translation.settings.defaultTags)
      .setDesc(this.plugin.translation.settingDescriptions.defaultTags)
      .addText((text) =>
        text
          .setPlaceholder(this.plugin.translation.settingPlaceHolders.defaultTags)
          .setValue(this.plugin.settings.defaultTags)
          .onChange(async (value) => {
            this.plugin.settings.defaultTags = value;
            await this.plugin.saveSettings();
          })
      );
  
    new Setting(containerEl)
      .setName(this.plugin.translation.settings.defaultFolder)
      .setDesc(this.plugin.translation.settingDescriptions.defaultFolder)
      .addText((text) =>
        text
          .setPlaceholder(this.plugin.translation.settingPlaceHolders.defaultFolder)
          .setValue(this.plugin.settings.defaultFolder)
          .onChange(async (value) => {
            this.plugin.settings.defaultFolder = value;
            await this.plugin.saveSettings();
          })
      );
  }
  
}