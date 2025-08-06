import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SddScriptExecutor {
    private readonly extensionPath: string;
    private readonly outputChannel: vscode.OutputChannel;

    constructor(extensionPath: string) {
        this.extensionPath = extensionPath;
        this.outputChannel = vscode.window.createOutputChannel('SDD Scripts');
    }

    private getScriptPath(scriptName: string): string {
        return path.join(this.extensionPath, 'scripts', scriptName);
    }

    private async executeScript(scriptPath: string, args: string[] = [], cwd?: string): Promise<{ stdout: string; stderr: string }> {
        const command = `bash "${scriptPath}" ${args.map(arg => `"${arg}"`).join(' ')}`;
        const workingDirectory = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        
        this.outputChannel.appendLine(`Executing: ${command}`);
        this.outputChannel.appendLine(`Working directory: ${workingDirectory}`);
        this.outputChannel.show();

        try {
            const result = await execAsync(command, { cwd: workingDirectory });
            this.outputChannel.appendLine(`Output: ${result.stdout}`);
            if (result.stderr) {
                this.outputChannel.appendLine(`Warnings: ${result.stderr}`);
            }
            return result;
        } catch (error: any) {
            this.outputChannel.appendLine(`Error: ${error.message}`);
            throw error;
        }
    }

    async createNewFeature(featureDescription: string): Promise<{ branchName: string; specFile: string; featureNum: string }> {
        if (!featureDescription) {
            throw new Error('Feature description is required');
        }

        const result = await this.executeScript(this.getScriptPath('create-new-feature.sh'), [featureDescription]);
        
        // Parse the output to extract important information
        const lines = result.stdout.split('\n');
        const branchName = lines.find(line => line.startsWith('BRANCH_NAME:'))?.split(': ')[1]?.trim() || '';
        const specFile = lines.find(line => line.startsWith('SPEC_FILE:'))?.split(': ')[1]?.trim() || '';
        const featureNum = lines.find(line => line.startsWith('FEATURE_NUM:'))?.split(': ')[1]?.trim() || '';

        return { branchName, specFile, featureNum };
    }

    async setupPlan(): Promise<{ featureSpec: string; implPlan: string; specsDir: string; branch: string }> {
        const result = await this.executeScript(this.getScriptPath('setup-plan.sh'));
        
        // Parse the output to extract paths
        const lines = result.stdout.split('\n');
        const featureSpec = lines.find(line => line.startsWith('FEATURE_SPEC:'))?.split(': ')[1]?.trim() || '';
        const implPlan = lines.find(line => line.startsWith('IMPL_PLAN:'))?.split(': ')[1]?.trim() || '';
        const specsDir = lines.find(line => line.startsWith('SPECS_DIR:'))?.split(': ')[1]?.trim() || '';
        const branch = lines.find(line => line.startsWith('BRANCH:'))?.split(': ')[1]?.trim() || '';

        return { featureSpec, implPlan, specsDir, branch };
    }

    async checkPrerequisites(): Promise<{ featureDir: string; availableDocs: string[] }> {
        const result = await this.executeScript(this.getScriptPath('check-task-prerequisites.sh'));
        
        // Parse the output
        const lines = result.stdout.split('\n');
        const featureDir = lines.find(line => line.startsWith('FEATURE_DIR:'))?.split(':')[1]?.trim() || '';
        
        // Extract available docs (lines that start with "  ✓")
        const availableDocs = lines.filter(line => line.trim().startsWith('✓')).map(line => line.trim().substring(2));

        return { featureDir, availableDocs };
    }

    async updateAgentContext(agentType?: string): Promise<void> {
        const args = agentType ? [agentType] : [];
        await this.executeScript(this.getScriptPath('update-agent-context.sh'), args);
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}