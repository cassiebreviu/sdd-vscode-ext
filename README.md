# SDD VSCode Extension

A VS Code extension for Specification-Driven Development (SDD) workflows.

## Features

### Spec Navigation
- Parses `spec.md` files and provides tree views for navigation
- Displays requirements and implementations in separate tree views
- Real-time parsing when spec files are saved or changed

### SDD Workflow Commands
This extension integrates the [SDD (Specification-Driven Development)](https://github.com/localden/sdd) bash scripts to provide a complete workflow for managing features:

- **SDD: Create New Feature** - Creates a new feature branch and directory structure in `specs/`
- **SDD: Setup Implementation Plan** - Sets up implementation plan template for the current feature
- **SDD: Check Task Prerequisites** - Validates that required files exist for implementation
- **SDD: Update Agent Context** - Updates agent context files for AI assistants (Claude, Gemini, Copilot)

All commands are available via:
- Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
- Toolbar buttons in the Spec Navigation view
- SDD output is displayed in the "SDD Scripts" output channel

## Setup

- Run `npm install` to install dependencies
- Press F5 to launch the extension in a new Extension Development Host window

## Usage

1. Open a workspace with Git repository
2. Use "SDD: Create New Feature" to start a new feature
3. Use "SDD: Setup Implementation Plan" to create plan templates
4. Use "SDD: Check Task Prerequisites" to verify setup
5. Use "SDD: Update Agent Context" to prepare AI assistant context

The extension automatically looks for `spec.md` files in your workspace and provides navigation tools.
