import update from 'immutability-helper';
import { App, MarkdownView, TFile } from 'obsidian';
import React from 'react';

import { Path } from 'src/dnd/types';
import { getEntityFromPath } from 'src/dnd/util/data';
import { StateManager } from 'src/StateManager';

import { Board, Item } from './types';

export const baseClassName = 'kanban-plugin';

export function noop() {}

export function c(className: string) {
  return `${baseClassName}__${className}`;
}

export function generateInstanceId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function maybeCompleteForMove(
  sourceBoard: Board,
  sourcePath: Path,
  destinationBoard: Board,
  destinationPath: Path,
  item: Item
): Item {
  const sourceParent = getEntityFromPath(sourceBoard, sourcePath.slice(0, -1));
  const destinationParent = getEntityFromPath(
    destinationBoard,
    destinationPath.slice(0, -1)
  );

  const oldShouldComplete = sourceParent?.data?.shouldMarkItemsComplete;
  const newShouldComplete = destinationParent?.data?.shouldMarkItemsComplete;

  // If neither the old or new lane set it complete, leave it alone
  if (!oldShouldComplete && !newShouldComplete) return item;

  // If it already matches the new lane, leave it alone
  if (newShouldComplete === !!item.data.isComplete) return item;

  // It's different, update it
  return update(item, {
    data: {
      isComplete: {
        $set: newShouldComplete,
      },
    },
  });
}

export function useIMEInputProps() {
  const isComposingRef = React.useRef<boolean>(false);

  return {
    // Note: these are lowercased because we use preact
    // See: https://github.com/preactjs/preact/issues/3003
    oncompositionstart: () => {
      isComposingRef.current = true;
    },
    oncompositionend: () => {
      isComposingRef.current = false;
    },
    getShouldIMEBlockAction: () => {
      return isComposingRef.current;
    },
  };
}

export const templaterDetectRegex = /<%/;

export async function applyTemplate(
  stateManager: StateManager,
  templatePath?: string
) {
  const templateFile = templatePath
    ? stateManager.app.vault.getAbstractFileByPath(templatePath)
    : null;

  if (templateFile && templateFile instanceof TFile) {
    const activeView = stateManager.app.workspace.activeLeaf.view;
    // Force the view to source mode, if needed
    if (
      activeView instanceof MarkdownView &&
      activeView.getMode() !== 'source'
    ) {
      await activeView.setState(
        {
          ...activeView.getState(),
          mode: 'source',
        },
        {}
      );
    }

    const {
      templatesEnabled,
      templaterEnabled,
      templatesPlugin,
      templaterPlugin,
    } = getTemplatePlugins(stateManager.app);

    const templateContent = await stateManager.app.vault.read(templateFile);

    // If both plugins are enabled, attempt to detect templater first
    if (templatesEnabled && templaterEnabled) {
      if (templaterDetectRegex.test(templateContent)) {
        return await templaterPlugin.append_template(templateFile);
      }

      return await templatesPlugin.instance.insertTemplate(templateFile);
    }

    if (templatesEnabled) {
      return await templatesPlugin.instance.insertTemplate(templateFile);
    }

    if (templaterEnabled) {
      return await templaterPlugin.append_template(templateFile);
    }

    // No template plugins enabled so we can just append the template to the doc
    await stateManager.app.vault.modify(
      stateManager.app.workspace.getActiveFile(),
      templateContent
    );
  }
}

export function getDefaultDateFormat(app: App) {
  const internalPlugins = (app as any).internalPlugins.plugins;
  const dailyNotesEnabled = internalPlugins['daily-notes']?.enabled;
  const dailyNotesValue =
    internalPlugins['daily-notes']?.instance.options.format;
  const nlDatesValue = (app as any).plugins.plugins['nldates-obsidian']
    ?.settings.format;
  const templatesEnabled = internalPlugins.templates?.enabled;
  const templatesValue = internalPlugins.templates?.instance.options.dateFormat;

  return (
    (dailyNotesEnabled && dailyNotesValue) ||
    nlDatesValue ||
    (templatesEnabled && templatesValue) ||
    'YYYY-MM-DD'
  );
}

export function getDefaultTimeFormat(app: App) {
  const internalPlugins = (app as any).internalPlugins.plugins;
  const nlDatesValue = (app as any).plugins.plugins['nldates-obsidian']
    ?.settings.timeFormat;
  const templatesEnabled = internalPlugins.templates?.enabled;
  const templatesValue = internalPlugins.templates?.instance.options.timeFormat;

  return nlDatesValue || (templatesEnabled && templatesValue) || 'HH:mm';
}

const reRegExChar = /[\\^$.*+?()[\]{}|]/g;
const reHasRegExChar = RegExp(reRegExChar.source);

export function escapeRegExpStr(str: string) {
  return str && reHasRegExChar.test(str)
    ? str.replace(reRegExChar, '\\$&')
    : str || '';
}

export function getTemplatePlugins(app: App) {
  const templatesPlugin = (app as any).internalPlugins.plugins.templates;
  const templatesEnabled = templatesPlugin.enabled;
  const templaterPlugin = (app as any).plugins.plugins['templater-obsidian'];
  const templaterEnabled = (app as any).plugins.enabledPlugins.has(
    'templater-obsidian'
  );
  const templaterEmptyFileTemplate =
    templaterPlugin &&
    (this.app as any).plugins.plugins['templater-obsidian'].settings
      ?.empty_file_template;

  const templateFolder = templatesEnabled
    ? templatesPlugin.instance.options.folder
    : templaterPlugin
    ? templaterPlugin.settings.template_folder
    : undefined;

  return {
    templatesPlugin,
    templatesEnabled,
    templaterPlugin: templaterPlugin?.templater,
    templaterEnabled,
    templaterEmptyFileTemplate,
    templateFolder,
  };
}
