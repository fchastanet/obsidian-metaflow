# Agent Instructions

Git branch is always master.

## Code rules

Generate code as a senior developer specialized in typescript and UI.

do not repeat yourself, use functions and classes to avoid code duplication.

Use adapter design pattern to integrate external api, instead of using it directly.

Use MVC design pattern.

Use services with dependency injection.

Always update/create associated unit tests.

Prefer using the command `npm run test` as test integration in vscode is buggy.

Always use `npm run test` after any code change to ensure that all tests pass.

## Chat Instructions

On chat, only provide the relevant changes but not all the file.

## Agent mode

In agent mode, always edit the files.

## Commit message

commit message ignore the files of installScripts and bin folders.

commit message should be in markdown format.

commit message should have a title that summarize the changes.

commit message should contains every relevant changes not just a summary.

## Ask questions

When you are not sure about the requirements, use askQuestion tool to clarify the requirements before any action.
