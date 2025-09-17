# Specify - Specification-Driven Development Extension

A VS Code extension for managing specifications and implementing specification-driven development workflows.

## Features

### 📋 Spec Management
- **Create Spec**: Easily create new specification files with a comprehensive template
- **Activity Bar Views**: Organized views for Requirements, Implementations, and Spec Navigation
- **Auto-parsing**: Automatically parses and updates spec content when files are saved

### 🚀 AI Integration
- **Implement Spec**: One-click integration with GitHub Copilot to implement specifications
- **Smart Parsing**: Intelligent parsing of markdown specifications into actionable items

### 📁 Project Structure
The extension expects specifications to be organized in a `specs/` directory with numbered subdirectories:
```
workspace/
├── specs/
│   └── 002-feature-name/
│       └── spec.md
```

## Getting Started

1. **Install the Extension**: Install from the VS Code marketplace or build from source
2. **Open a Workspace**: Open a folder in VS Code where you want to create specifications
3. **Create Your First Spec**: Click the "Create Spec" button (plus icon) in the Specify activity bar
4. **Start Implementing**: Use the "Implement Spec" button (rocket icon) to send specs to Copilot

For more detailed guidance on writing effective specifications, check out the [Spec Kit](https://github.com/github/spec-kit) - a comprehensive guide to specification-driven development.

## Activity Bar Views

### Spec Navigation
Browse all sections and subsections of your specification files.

### Requirements 
View all user stories, scenarios, and functional requirements extracted from your specs.

### Implementations
Track implementation tasks and their completion status with visual indicators:
- ✓ Completed tasks
- ⏳ In-progress tasks  
- ◯ Pending tasks

## Commands

- **Create Spec**: Creates a new specification file with template content
- **Implement Spec**: Sends "implement the spec" to GitHub Copilot chat
- **Reparse Spec**: Manually refresh and reparse specification files

## Development

### Setup
```bash
npm install
```

### Run Extension
Press `F5` to launch the extension in a new Extension Development Host window.

### Build
```bash
npm run compile
```

### Watch Mode
```bash
npm run watch
```

## Requirements

- VS Code 1.80.0 or higher
- GitHub Copilot extension (for AI integration features)

## License

This project is licensed under the MIT License.