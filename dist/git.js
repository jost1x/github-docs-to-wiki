"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.execCommand = execCommand;
exports.getExecOutput = getExecOutput;
exports.getWikiCommitMessage = getWikiCommitMessage;
exports.hasStagedChanges = hasStagedChanges;
const exec = __importStar(require("@actions/exec"));
const fs_utils_1 = require("./fs-utils");
const COMMIT_MESSAGE_TOKEN = /\{commitMessage\}/g;
const SHA_FULL_TOKEN = /\{shaFull\}/g;
const SHA_SHORT_TOKEN = /\{shaShort\}/g;
async function execCommand(command, args, options = {}) {
    const exitCode = await exec.exec(command, args, options);
    if (exitCode !== 0) {
        throw new Error(`Command failed: ${command} ${args.join(' ')}`);
    }
}
async function getExecOutput(command, args, cwd) {
    let stdout = '';
    let stderr = '';
    const exitCode = await exec.exec(command, args, {
        cwd,
        silent: true,
        ignoreReturnCode: true,
        listeners: {
            stdout: (data) => {
                stdout += data.toString();
            },
            stderr: (data) => {
                stderr += data.toString();
            },
        },
    });
    if (exitCode !== 0) {
        throw new Error((0, fs_utils_1.trimTrailingLineBreaks)(stderr) || `Command failed: ${command} ${args.join(' ')}`);
    }
    return (0, fs_utils_1.trimTrailingLineBreaks)(stdout);
}
async function getWikiCommitMessage(context) {
    if (!context.customCommitMessageFormat) {
        return 'Sync Files';
    }
    let commitMessage = context.customCommitMessageFormat;
    const latestMessage = await getExecOutput('git', ['log', '-1', '--pretty=%B'], context.sourceRepoDirectory);
    commitMessage = commitMessage.replace(COMMIT_MESSAGE_TOKEN, latestMessage);
    const shaFull = await getExecOutput('git', ['rev-parse', 'HEAD'], context.sourceRepoDirectory);
    commitMessage = commitMessage.replace(SHA_FULL_TOKEN, shaFull);
    const shaShort = await getExecOutput('git', ['rev-parse', '--short', 'HEAD'], context.sourceRepoDirectory);
    return commitMessage.replace(SHA_SHORT_TOKEN, shaShort);
}
async function hasStagedChanges(cwd) {
    const output = await getExecOutput('git', ['diff', '--cached', '--name-only'], cwd);
    return output.length > 0;
}
