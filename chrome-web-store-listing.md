# Chrome Web Store Listing

## Extension Name

SNOW Bot

## Short Description

Browser automation assistant for form filling, scriptable workflows, and task automation.

## Detailed Description

SNOW Bot is a browser automation assistant that helps you automate repetitive web tasks, fill forms faster, and streamline your workflow with scriptable multi-step automations.

Create text templates with placeholders that auto-populate from form fields on the page. Build custom scripts using a visual editor with conditions and actions. Set up triggers to run automations automatically on page events or timers. Use the chat interface to search and execute scripts with real-time progress updates. Launch scripts instantly from a customizable button grid.

Getting started is simple. Install the extension and click the power button to enable it. Open the popup to create your first text template with shortcodes like [FieldName] that resolve from matching page labels. Use the script editor to build automations by adding conditions that check page state and actions that interact with form elements. Assign scripts to triggers so they run automatically when you visit specific pages or when events occur. Use the chat to search scripts by name and execute them, or add them to a button grid for one-click access.

This extension requests permissions for tabs, storage, notifications, and access to all URLs. Tabs and storage are used to manage your scripts and settings. Notifications provide alerts when automations complete. Access to all URLs is required so the content script can run on any page you choose to automate. No data is sent to external servers. All scripts, templates, and settings are stored locally in your browser.

For support, feedback, or bug reports, visit the GitHub repository or open an issue. Contributions and feature requests are welcome.

## Category

Productivity

## Language

English

## Single Purpose

SNOW Bot serves a clear purpose: automating repetitive browser tasks and form filling. The extension provides text templates, scriptable workflows, and trigger-based automations to help users complete routine web interactions faster. All functionality is directly related to this core purpose of browser task automation.

## Permissions Justification

tabs: Required to communicate with browser tabs and track the active tab for automation.
storage: Required to save your templates, scripts, triggers, button grids, and settings locally.
unlimitedStorage: Required to store unlimited scripts, templates, logs, and user configurations without size limits.
notifications: Required to send desktop notifications when automations complete or alerts trigger.
contextMenus: Required to provide right-click menu options for element selection.
webNavigation: Required to detect page navigation and manage cross-frame automation.
webRequest: Required to monitor network requests for trigger conditions and automation workflows.
dns: Required to resolve domain names for URL-based conditions and cross-origin automation.
privacy: Required to manage browser privacy settings that may affect extension functionality on restricted pages.
all_urls: Required so the content script can run on any website you choose to automate.
