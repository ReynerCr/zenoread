# Agent Directives for Project ZenoRead:

1. Language Policy: All generated code, variable names, database schemas, code comments, and project documentation MUST be written strictly in English.

2. **Plans, Todo's and guidelines for implementations:** This kind of files go into the docs/plans folder. All files here are mainly written in markdown format and represent active and completed plans according to where they are located:
   * **docs/plans**: contains active plans.
   * **docs/plans/completed**: contains plans that were completed, mimicking an archive of old plans, and don't require further inspection unless it is strictly required to look at previous implementations guidelines.

Files may have a number or a version that represents their implementation order (e.g. completed plans may be named like "PLAN-1.md" or "PLAN-v1.md" in completed folder and it may indicate that it is the first PLAN implemented). 

3. Execution Flow: You must follow the active plan file(s) in docs/plans (ignore completed folder unless specified by user). Work strictly on one phase at a time. Do NOT jump ahead to future phases until I review the current progress and explicitly give you the green light to proceed.

4. **Sandbox Environment & Write Permissions Protocol:**
   * **Context:** You are executing commands within a sandbox environment: an external, highly restrictive custom Bubblewrap (bwrap) sandbox. By default, the filesystem is mounted as Read-Only (`ro`), and any untracked storage is restricted (read-only).
   * **Action Required:** If any tool, compilation, or shell command fails due to a `Read-only file system` error (or related permission issues), you MUST immediately HALT all execution pipelines. Do not attempt to retry or bypass the error.
   * **User Intervention:** Stop and explicitly ask the user in the chat to grant the required path permissions manually. Wait until the user confirms the permissions have been updated before resuming execution.

5. **Comments**: Comments should be meaningful and concise. It is preferred to not add comments or be VERY brief if they will overexplain things already explained in any documentation (e.g. README, plans, etc). If something exceptional requires explanation (e.g. something could not be done in an appropiate way because of x, a security note on CVE's, code is too complicated or too abstract to gather the idea of what it does in a quick inspection, etc) then you can add comments but be brief.

6. **Tech stack**: the tech stack is:
*   **Native Shell / Desktop OS:** Tauri v2
*   **Frontend Framework:** Vue 3 (Composition API, Vite, TypeScript, TailwindCSS)
*   **Database / Local Persistence:** RxDB (Utilizing the IndexedDB storage provided by Tauri's WebView).
