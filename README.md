# 📝 Specify VS Code Extension

### Supercharge your Spec-Driven Development workflow in VS Code.

A powerful VS Code extension that seamlessly integrates with [Spec Kit](https://github.com/github/spec-kit) to provide a visual interface for managing specifications, requirements, implementations, and tasks directly in your development environment.

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![VS Code Version](https://img.shields.io/badge/VS%20Code-^1.80.0-blue)
![Version](https://img.shields.io/badge/version-0.0.6-green)

## Table of Contents

- 🤔 [What is the Specify Extension?](#-what-is-the-specify-extension)
- ⚡ [Get started](#-get-started)
- 🎯 [Key Features](#-key-features)
- 🖥️ [Extension Overview](#️-extension-overview)
- 📖 [Learn more](#-learn-more)
- 💬 [Support](#-support)
- 📄 [License](#-license)

## 🤔 What is the Specify Extension?

The Specify VS Code Extension transforms your editor into a comprehensive Spec-Driven Development workspace. This extension provides a wrapper and integration into VS Code of the Specify CLI that is part of Spec Kit on GitHub. This includes:

- **Visual spec navigation** with hierarchical tree views
- **Real-time file parsing** that automatically updates when you save
- **Integrated GitHub Copilot commands** for seamless AI-assisted development
- **Task management** with progress tracking and parallel execution indicators
- **One-click project initialization** using the latest Spec Kit templates

This extension bridges the gap between specification documents and implementation, making Spec-Driven Development more accessible and efficient for individual developers and teams.

## ⚡ Get started

### 1. Install from GitHub Releases in this Repo (Recommended)

Download and install the latest build directly from GitHub:

1. **Download the latest release**:
   - Go to [GitHub Releases](https://github.com/cassiebreviu/sdd-vscode-ext/releases)
   - Find the latest release and download the `.vsix` file

2. **Install in VS Code**:
   - Open VS Code
   - Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
   - Type "Extensions: Install from VSIX..."
   - Select the downloaded `.vsix` file
   - Click "Install" when prompted

3. **Reload VS Code**:
   - Press `Ctrl+Shift+P` / `Cmd+Shift+P`
   - Type "Developer: Reload Window" and press Enter
   - The Specify extension should now be active

### 2. Verify Installation

After installation, you should see:
- **Specify icon** (📝) in the VS Code Activity Bar (left sidebar)
- **Four panel views** when you click the Specify icon:
  - Actions
  - Spec Navigation  
  - Requirements
  - Implementations

### 3. Begin Your Spec-Driven Workflow

1. Start a New Project

Use the **"1. Start Specify"** action to initialize a new Spec-Driven Development project:

- Click the Specify icon in the Activity Bar
- Click **"1. Start Specify"** in the Actions panel
- Follow the interactive prompts to set up your project

NOTE: This code utilizes the 'uv' package manager for Python environments. 
It assumes 'uv' is installed in your system. 
If 'uv' is not installed, you will need to install it and restart your environment for the changes to take effect.

Once initialized, use the numbered workflow actions:

2. **Specify** - Define what you want to build  
3. **Plan** - Create technical implementation plans
4. **Tasks** - Generate actionable task lists
5. **Implement** - Execute implementation with AI assistance

## 🎯 Key Features

### Visual Specification Management
- **Hierarchical Navigation**: Browse specs with collapsible sections and subsections
- **Smart Parsing**: Automatic detection of requirements, implementations, and tasks
- **Real-time Updates**: File watchers ensure views stay synchronized with your documents
- **Quick Navigation**: Click any item to jump directly to the relevant line in your spec file

### GitHub Copilot Integration
- **Slash Command Support**: Built-in commands for `/specify`, `/plan`, `/tasks`, and `/implement`
- **Context-Aware AI**: Extension passes relevant spec context to Copilot for better responses
- **Fallback Handling**: Multiple fallback mechanisms ensure Copilot integration works reliably

### Progress Tracking
- **Implementation Status**: Visual indicators for completed, in-progress, and pending items
- **Parallel Task Detection**: Special icons for tasks that can run concurrently
- **Phase Organization**: Tasks grouped by development phases with clear dependencies

### Project Initialization
- **Spec Kit Integration**: Direct integration with the latest Spec Kit templates
- **Cross-Platform Support**: Works on Windows, macOS, and Linux
- **Interactive Setup**: Guided prompts for AI assistant selection and configuration

## 🖥️ Extension Overview

The extension adds a dedicated **Specify** activity bar with four main views:

### Actions Panel
Quick access to the main steps of the Spec-Driven Development workflow:
- 🚀 **Start Specify**: Initialize new projects
- 💡 **Specify**: Define requirements and features
- 🪄 **Plan**: Create technical implementation plans  
- ✅ **Tasks**: Generate actionable task lists
- 🚀 **Implement**: Execute implementation tasks

### Spec Navigation
Overview of your specification document with one click navigation to the markdown files for edits.
- 📖 **Sections**: Major specification sections
- 📄 **Subsections**: Detailed breakdowns within sections
- 📝 **Items**: Individual specification points and details

### Requirements View  
Focused view of user requirements and scenarios:
- 👤 **User Stories**: User-focused requirements
- 🎯 **Functional Requirements**: System capabilities  
- 🧪 **Test Scenarios**: Validation criteria

### Implementations View
Track development progress and implementation status:
- ✅ **Completed**: Finished implementation items
- ⭕ **Pending**: Upcoming implementation tasks

## 🔧 Extension Commands

| Command | Description | Keybinding |
|---------|-------------|------------|
| `Reparse Spec` | Manually refresh spec file parsing | - |
| `Start Project` | Initialize new Specify project | - |
| `Specify Command` | Send custom specification to Copilot | - |
| `Plan Command` | Create technical plans with Copilot | - |
| `Tasks Command` | Generate task lists with Copilot | - |
| `Implement Spec` | Execute implementation with Copilot | - |
| `Open Spec Section` | Navigate to specific spec section | - |

### Command Palette Integration

All commands are available via VS Code's Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `Specify: Reparse Spec`
- `Specify: Start New Project`  
- `Specify: Create Specification`
- `Specify: Generate Plan`
- `Specify: Create Tasks`
- `Specify: Implement Feature`

### File Watching and Auto-Refresh

The extension monitors your specification files and automatically updates views when files change, ensuring your navigation always reflects the current state of your specifications.


## 📖 Learn more

- **[Spec Kit Repository](https://github.com/github/spec-kit)** - The foundational toolkit for Spec-Driven Development
- **[Spec-Driven Development Guide](https://github.com/github/spec-kit/blob/main/spec-driven.md)** - Complete methodology documentation
- **[VS Code Extension API](https://code.visualstudio.com/api)** - For dev
## 💬 Support

For support, please:

1. **Check existing issues**: Browse [GitHub Issues](https://github.com/cassiebreviu/sdd-vscode-ext/issues) for known problems
2. **Create new issues**: Report bugs or request features on GitHub
3. **Community discussions**: Join conversations about Spec-Driven Development
4. **Documentation**: Refer to this README and the Spec Kit documentation

When reporting issues, please include:
- VS Code version
- Extension version  
- Operating system
- Steps to reproduce
- Error messages or logs

## 📄 License

This project is licensed under the terms of the MIT open source license. Please refer to the [LICENSE](LICENSE) file for the full terms.

---

**Made with ❤️ for Spec-Driven Development**

Transform your development workflow with the power of structured specifications, intelligent parsing, and AI-assisted implementation right in VS Code. Happy coding! 🚀
