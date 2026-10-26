---
id: E-xx
title: <Epic name>
status: todo           # todo | in-progress | in-uat | done
approved:              # date the user approved this epic's tasks (set by /plan-backlog)
change:                # brownfield only: the change ID this epic implements (C-NN)
branch:                # set by /build-epic: epic/E-xx-<slug> (epic-branch workflow)
pr:                    # set by /build-epic: link to the draft pull request
requirements: [F-xx]
---

# E-xx <Epic name>

## Goal

<The capability users get when this epic is done, in one or two sentences.>

## Requirements covered

- F-xx <name>

## Stories

- S-xx-01 <name>

## Technology

<"As in docs/architecture/tech-stack.md, confirmed YYYY-MM-DD" or the differences confirmed for this epic, with date.>

## Done when

- <observable outcome a user or stakeholder can check>

## UAT

<Written by /qa-task in UAT.md when all stories are done; the epic is done after the user confirms it.>

## Out of scope for this epic

- <item>
