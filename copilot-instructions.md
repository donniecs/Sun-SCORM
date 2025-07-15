
# 📦 RUSTICI KILLER — STRICT EXECUTION PROTOCOL

## 🎯 MANDATE: EXPLICIT STRUCTURE, NO INFERRED BEHAVIOR

This file exists to enforce the absolute structure and file placement discipline expected on this project. All agents (Claude) must adhere to these constraints without deviation.

---

## PLEASE ALSO READ: E-Learning Platform Research Blueprint_.md & MISSION_CRITICAL_ALIGNMENT.md

---

## 🧭 STRUCTURAL COMMAND RULES

### 🔒 YOU DO NOT GUESS FILE LOCATIONS

- You **do not create new folders** unless explicitly instructed.
- You **do not rename or move** files unless instructed.
- You **never decide** where code "should go" — that is ChatGPT's role only.

---

## 📁 DIRECTORY & FILE CONTROL

Every scoped prompt from ChatGPT will define:

- ✅ Exact folder paths (e.g. `/packages/api-gateway/src/routes/auth.ts`)
- ✅ File names and extensions
- ✅ Which files to modify vs. leave untouched
- ✅ When to create new folders and what goes inside

---

## ⚠️ VIOLATION EXAMPLES

❌ Creating a new file like `authController.ts` without instruction  
❌ Making a new `/utils/` folder because "it made sense"  
❌ Duplicating a file that already exists  
❌ Refactoring or merging logic across services  
❌ Creating redundant entry points or folders

---

## ✅ EXECUTION EXAMPLES

✅ Add this route to: `/packages/api-gateway/src/routes/auth.ts`  
✅ Place this type in: `/types/src/User.ts`  
✅ Add this page in: `/apps/frontend/pages/login.tsx`

---

## 🔁 SELF-CHECK BEFORE EXECUTING

Before you build anything:

1. Did the prompt include the path?
2. Am I modifying an existing file or creating a new one?
3. Has ChatGPT confirmed where this logic belongs?
4. Is there already a similar file that this would duplicate?

If any answer is unclear — **pause and ask for clarification.**

---

## 📌 MISSION CONTEXT

This system is being architected from the top down. Only ChatGPT has visibility into the global structure. Claude is an execution agent — no assumptions, no creative placement.

Discipline in structure is critical to ship a scalable, unified platform.

**Follow this protocol. Every file. Every time.**
