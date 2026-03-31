import * as exec from '@actions/exec';

import { trimTrailingLineBreaks } from './fs-utils';
import { ActionContext } from './types';

const COMMIT_MESSAGE_TOKEN = /\{commitMessage\}/g;
const SHA_FULL_TOKEN = /\{shaFull\}/g;
const SHA_SHORT_TOKEN = /\{shaShort\}/g;

export async function execCommand(
    command: string,
    args: string[],
    options: exec.ExecOptions = {},
): Promise<void> {
    const exitCode = await exec.exec(command, args, options);

    if (exitCode !== 0) {
        throw new Error(`Command failed: ${command} ${args.join(' ')}`);
    }
}

export async function getExecOutput(
    command: string,
    args: string[],
    cwd: string,
): Promise<string> {
    let stdout = '';
    let stderr = '';

    const exitCode = await exec.exec(command, args, {
        cwd,
        silent: true,
        ignoreReturnCode: true,
        listeners: {
            stdout: (data: Buffer) => {
                stdout += data.toString();
            },
            stderr: (data: Buffer) => {
                stderr += data.toString();
            },
        },
    });

    if (exitCode !== 0) {
        throw new Error(
            trimTrailingLineBreaks(stderr) || `Command failed: ${command} ${args.join(' ')}`,
        );
    }

    return trimTrailingLineBreaks(stdout);
}

export async function getWikiCommitMessage(context: ActionContext): Promise<string> {
    if (!context.customCommitMessageFormat) {
        return 'Sync Files';
    }

    let commitMessage = context.customCommitMessageFormat;
    const latestMessage = await getExecOutput(
        'git',
        ['log', '-1', '--pretty=%B'],
        context.sourceRepoDirectory,
    );
    commitMessage = commitMessage.replace(COMMIT_MESSAGE_TOKEN, latestMessage);

    const shaFull = await getExecOutput(
        'git',
        ['rev-parse', 'HEAD'],
        context.sourceRepoDirectory,
    );
    commitMessage = commitMessage.replace(SHA_FULL_TOKEN, shaFull);

    const shaShort = await getExecOutput(
        'git',
        ['rev-parse', '--short', 'HEAD'],
        context.sourceRepoDirectory,
    );

    return commitMessage.replace(SHA_SHORT_TOKEN, shaShort);
}
