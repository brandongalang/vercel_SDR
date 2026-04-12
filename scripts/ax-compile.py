#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "synthetic-jobs-v2.json"
PROMPT_SNAPSHOTS_PATH = ROOT / "data" / "prompt-snapshots.json"
DEFAULT_OUT_PATH = ROOT / "data" / "ax-optimized-v3.json"
DEFAULT_PROGRAM_PATH = ROOT / "data" / "ax-optimized-v3.dspy.json"

OBJECTIVE_WEIGHTS = {
    "cleanAccept": 0.2,
    "workableReply": 0.8,
}

PROJECTION_PRIORS = {
    "cleanAcceptRate": 11.2,
    "replyRate": 1.8,
    "positiveRate": 3.4,
}

GENERIC_OPENERS = (
    "hope you're well",
    "hope you are well",
    "wanted to reach out",
    "just reaching out",
    "checking in",
    "quick note",
)

OUTCOME_TERMS = (
    "faster iteration",
    "reliability",
    "reliability at scale",
    "developer velocity",
    "preview governance",
    "release confidence",
    "cache",
    "caching",
    "benchmark",
    "case study",
    "checklist",
)

LOW_FRICTION_CTA_TERMS = (
    "benchmark",
    "case study",
    "checklist",
    "artifact",
    "walkthrough",
    "compare",
    "scoped call",
    "15-min",
    "15 min",
    "brief",
    "short",
    "useful",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compile or mock-build a DSPy optimization artifact for SDR draft generation."
    )
    parser.add_argument("--mock", action="store_true", help="Skip DSPy/LLM calls and emit a heuristic artifact.")
    parser.add_argument("--dataset", type=Path, default=DATASET_PATH, help="Path to synthetic jobs JSON.")
    parser.add_argument(
        "--prompt-snapshots",
        type=Path,
        default=PROMPT_SNAPSHOTS_PATH,
        help="Path to prompt snapshot JSON.",
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_PATH, help="Artifact output path.")
    parser.add_argument(
        "--save-program",
        type=Path,
        default=DEFAULT_PROGRAM_PATH,
        help="Where to save the raw compiled DSPy program in real mode.",
    )
    parser.add_argument("--demos", type=int, default=6, help="How many demos to keep in the artifact.")
    parser.add_argument("--auto", default="medium", choices=("light", "medium", "heavy"))
    parser.add_argument("--max-bootstrapped-demos", type=int, default=4)
    parser.add_argument("--max-labeled-demos", type=int, default=6)
    parser.add_argument(
        "--model",
        default=os.getenv("DSPY_MODEL"),
        help='Task model for real mode, e.g. "openai/gpt-4o-mini".',
    )
    parser.add_argument(
        "--teacher-model",
        default=os.getenv("DSPY_TEACHER_MODEL"),
        help='Teacher model for real mode, e.g. "openai/gpt-4o".',
    )
    parser.add_argument(
        "--prompt-model",
        default=os.getenv("DSPY_PROMPT_MODEL"),
        help='Prompt proposal model for real mode, e.g. "openai/gpt-4o-mini".',
    )
    parser.add_argument(
        "--compiled-at",
        help="Override compiledAt ISO timestamp. Defaults to the v3 release date in mock mode, current time otherwise.",
    )
    return parser.parse_args()


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def path_for_artifact(path: Path) -> str:
    resolved = path.resolve()
    try:
        return str(resolved.relative_to(ROOT))
    except ValueError:
        return str(path)


def normalized_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def body_word_count(body: str) -> int:
    return len(re.findall(r"\b[\w'-]+\b", body))


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [part.strip() for part in parts if part.strip()]


def top_signal(job: dict[str, Any]) -> dict[str, Any]:
    signals = job.get("signals") or []
    used = [signal for signal in signals if signal.get("usedInAngle")]
    ranked = used or signals
    if not ranked:
        return {
            "label": "No ranked signal",
            "value": job.get("whyNow") or job.get("angle") or "",
            "source": "derived",
            "rank": 999,
            "strength": "weak",
        }
    return sorted(ranked, key=lambda signal: (signal.get("rank", 999), signal.get("id", "")))[0]


def signal_summary(signal: dict[str, Any]) -> str:
    label = signal.get("label", "").strip()
    value = signal.get("value", "").strip()
    return ": ".join(part for part in (label, value) if part)


def format_lead_context(job: dict[str, Any], signal: dict[str, Any]) -> str:
    lead = job.get("lead") or {}
    play = job.get("play") or {}
    confidence = ((job.get("confidence") or {}).get("summary") or "").strip()
    parts = [
        f"{lead.get('name', 'Unknown lead')} is {lead.get('title', 'Unknown title')} at {job.get('company', 'Unknown company')}.",
        f"Play: {play.get('label', job.get('angleType', 'unknown'))}.",
        f"Top signal: {signal_summary(signal)}.",
    ]
    if play.get("context"):
        parts.append(f"Play context: {play['context']}.")
    if job.get("whyNow"):
        parts.append(f"Why now: {job['whyNow']}.")
    if confidence:
        parts.append(f"Confidence: {confidence}.")
    return " ".join(parts)


def format_prior_draft(job: dict[str, Any]) -> str:
    draft = job.get("draft") or {}
    subject = draft.get("subject", "").strip()
    body = draft.get("body", "").strip()
    return f"Subject: {subject}\nBody:\n{body}".strip()


def label_bool(value: Any) -> bool:
    return value is True


def workable_reply_label(job: dict[str, Any]) -> bool:
    outcome = job.get("outcome") or {}
    feedback = job.get("feedback") or {}
    return label_bool(outcome.get("positive")) or label_bool(feedback.get("positiveReply"))


def reply_label(job: dict[str, Any]) -> bool:
    outcome = job.get("outcome") or {}
    return label_bool(outcome.get("replied")) or workable_reply_label(job)


def clean_accept_label(job: dict[str, Any]) -> bool:
    feedback = job.get("feedback") or {}
    return feedback.get("edited") is False


def objective_label_score(job: dict[str, Any]) -> float:
    return round(
        OBJECTIVE_WEIGHTS["cleanAccept"] * (1.0 if clean_accept_label(job) else 0.0)
        + OBJECTIVE_WEIGHTS["workableReply"] * (1.0 if workable_reply_label(job) else 0.0),
        4,
    )


def signal_keywords(signal: dict[str, Any]) -> list[str]:
    candidate = " ".join(
        str(signal.get(key, "")).strip() for key in ("label", "value", "category") if signal.get(key)
    )
    tokens = re.findall(r"\b[a-zA-Z][a-zA-Z0-9'-]{3,}\b", candidate.lower())
    stop_words = {"this", "that", "with", "from", "have", "your", "their", "about", "into"}
    ordered: list[str] = []
    for token in tokens:
        if token in stop_words or token in ordered:
            continue
        ordered.append(token)
    return ordered[:6]


def clean_accept_proxy(example: dict[str, Any], subject: str, body: str) -> float:
    body_text = normalized_text(body)
    first_sentence = normalized_text(split_sentences(body)[0] if split_sentences(body) else body)
    keywords = signal_keywords(example["topSignal"])

    score = 0.0
    if subject and len(subject.split()) <= 7 and "?" not in subject:
        score += 0.2
    if body_word_count(body) <= 100:
        score += 0.25
    if keywords and any(keyword in first_sentence for keyword in keywords):
        score += 0.25
    if not any(opener in body_text for opener in GENERIC_OPENERS):
        score += 0.15
    if any(term in body_text for term in LOW_FRICTION_CTA_TERMS):
        score += 0.15
    return min(score, 1.0)


def workable_reply_proxy(example: dict[str, Any], subject: str, body: str) -> float:
    body_text = normalized_text(body)
    first_sentence = normalized_text(split_sentences(body)[0] if split_sentences(body) else body)
    keywords = signal_keywords(example["topSignal"])

    score = 0.0
    if keywords and sum(1 for keyword in keywords if keyword in first_sentence) >= 1:
        score += 0.35
    if any(term in body_text for term in OUTCOME_TERMS):
        score += 0.25
    if any(term in body_text for term in LOW_FRICTION_CTA_TERMS):
        score += 0.25
    if body_word_count(body) <= 100:
        score += 0.15
    return min(score, 1.0)


def build_example(job: dict[str, Any]) -> dict[str, Any]:
    signal = top_signal(job)
    draft = job.get("draft") or {}
    return {
        "id": job["id"],
        "leadContext": format_lead_context(job, signal),
        "topSignal": {
            "label": signal.get("label"),
            "value": signal.get("value"),
            "category": signal.get("category"),
            "strength": signal.get("strength"),
            "source": signal.get("source"),
            "rank": signal.get("rank"),
        },
        "draft": {
            "subject": draft.get("subject", ""),
            "body": draft.get("body", ""),
        },
        "priorDraft": format_prior_draft(job),
        "labels": {
            "cleanAccept": clean_accept_label(job),
            "replied": reply_label(job),
            "positiveReply": workable_reply_label(job),
        },
        "objectiveScore": objective_label_score(job),
        "angleType": job.get("angleType"),
    }


def select_mock_demos(examples: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    ranked = sorted(
        examples,
        key=lambda example: (
            -example["objectiveScore"],
            -int(example["labels"]["positiveReply"]),
            -int(example["labels"]["replied"]),
            example["topSignal"].get("rank") or 999,
            example["id"],
        ),
    )
    return ranked[:limit]


def round_rate(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value, 1)


def version_row(jobs: list[dict[str, Any]], draft_prompt_version: str) -> dict[str, Any]:
    with_feedback = [job for job in jobs if job.get("feedback") is not None]
    clean_accept = sum(1 for job in with_feedback if clean_accept_label(job))
    edited = len(with_feedback) - clean_accept
    sent_with_outcome = [
        job
        for job in jobs
        if job.get("status") == "sent_stub"
        and (job.get("outcome") is not None or (job.get("feedback") or {}).get("positiveReply") is not None)
    ]
    replied = sum(1 for job in sent_with_outcome if reply_label(job))
    positive = sum(1 for job in sent_with_outcome if workable_reply_label(job))
    return {
        "draftPromptVersion": draft_prompt_version,
        "angleType": None,
        "jobCount": len(jobs),
        "withFeedback": len(with_feedback),
        "cleanAccept": clean_accept,
        "edited": edited,
        "cleanAcceptRate": round_rate((clean_accept / len(with_feedback) * 100) if with_feedback else None),
        "editRate": round_rate((edited / len(with_feedback) * 100) if with_feedback else None),
        "sentWithOutcome": len(sent_with_outcome),
        "replied": replied,
        "positive": positive,
        "replyRate": round_rate((replied / len(sent_with_outcome) * 100) if sent_with_outcome else None),
        "positiveRate": round_rate((positive / len(sent_with_outcome) * 100) if sent_with_outcome else None),
    }


def projected_row(baseline_row: dict[str, Any], prompt_version_after: str) -> dict[str, Any]:
    projected = deepcopy(baseline_row)
    projected["draftPromptVersion"] = prompt_version_after

    feedback_denominator = projected["withFeedback"]
    outcome_denominator = projected["sentWithOutcome"]

    target_clean = min(100.0, (baseline_row["cleanAcceptRate"] or 0.0) + PROJECTION_PRIORS["cleanAcceptRate"])
    target_reply = min(100.0, (baseline_row["replyRate"] or 0.0) + PROJECTION_PRIORS["replyRate"])
    target_positive = min(100.0, (baseline_row["positiveRate"] or 0.0) + PROJECTION_PRIORS["positiveRate"])

    projected_clean = min(feedback_denominator, round(target_clean * feedback_denominator / 100.0))
    projected_reply = min(outcome_denominator, round(target_reply * outcome_denominator / 100.0))
    projected_positive = min(projected_reply, round(target_positive * outcome_denominator / 100.0))

    projected["cleanAccept"] = projected_clean
    projected["edited"] = max(feedback_denominator - projected_clean, 0)
    projected["cleanAcceptRate"] = round_rate((projected_clean / feedback_denominator * 100) if feedback_denominator else None)
    projected["editRate"] = round_rate((projected["edited"] / feedback_denominator * 100) if feedback_denominator else None)
    projected["replied"] = projected_reply
    projected["positive"] = projected_positive
    projected["replyRate"] = round_rate((projected_reply / outcome_denominator * 100) if outcome_denominator else None)
    projected["positiveRate"] = round_rate((projected_positive / outcome_denominator * 100) if outcome_denominator else None)
    return projected


def compute_deltas(before: dict[str, Any], after: dict[str, Any]) -> dict[str, float]:
    return {
        "cleanAcceptRate": round((after["cleanAcceptRate"] or 0.0) - (before["cleanAcceptRate"] or 0.0), 1),
        "editRate": round((after["editRate"] or 0.0) - (before["editRate"] or 0.0), 1),
        "replyRate": round((after["replyRate"] or 0.0) - (before["replyRate"] or 0.0), 1),
        "positiveRate": round((after["positiveRate"] or 0.0) - (before["positiveRate"] or 0.0), 1),
    }


def latest_prompt_version(jobs: list[dict[str, Any]]) -> str:
    versions = {
        (job.get("promptVersions") or {}).get("draftGenerator")
        for job in jobs
        if (job.get("promptVersions") or {}).get("draftGenerator")
    }
    if not versions:
        raise ValueError("No draftGenerator prompt versions found in dataset.")
    return sorted(versions)[-1]


def snapshot_index(snapshots: Iterable[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for snapshot in snapshots:
        if snapshot.get("version"):
            index[snapshot["version"]] = snapshot
        if snapshot.get("label"):
            index[snapshot["label"]] = snapshot
    return index


def infer_compiled_at(args: argparse.Namespace, v3_snapshot: dict[str, Any]) -> str:
    if args.compiled_at:
        return args.compiled_at
    if args.mock and v3_snapshot.get("releaseDate"):
        return f"{v3_snapshot['releaseDate']}T00:00:00Z"
    return iso_now()


def build_artifact(
    *,
    instruction: str,
    demos: list[dict[str, Any]],
    compiled_at: str,
    optimizer: str,
    prompt_version_before: str,
    prompt_version_after: str,
    baseline_row: dict[str, Any],
    projected_version_row: dict[str, Any],
    mode: str,
    saved_program_path: str | None = None,
    optimized_instruction: str | None = None,
) -> dict[str, Any]:
    artifact = {
        "instruction": instruction,
        "demos": demos,
        "compiledAt": compiled_at,
        "optimizer": optimizer,
        "mode": mode,
        "promptVersionBefore": prompt_version_before,
        "promptVersionAfter": prompt_version_after,
        "objective": {
            "label": "0.2 clean-accept proxy + 0.8 workable-reply proxy",
            "weights": OBJECTIVE_WEIGHTS,
        },
        "evaluation": {
            "kind": "projection",
            "basis": "baseline-v2-plus-compile-deltas",
            "baselineVersionRow": baseline_row,
            "projectedVersionRow": projected_version_row,
            "deltas": compute_deltas(baseline_row, projected_version_row),
            "projectionSource": {
                "dataset": str(DATASET_PATH.relative_to(ROOT)),
                "priors": PROJECTION_PRIORS,
                "rounding": "Projected rates converted to whole-example counts for a revealable v3 row.",
            },
        },
    }
    if optimized_instruction and optimized_instruction != instruction:
        artifact["optimizedInstruction"] = optimized_instruction
    if saved_program_path:
        artifact["savedProgramPath"] = saved_program_path
    return artifact


def serialize_program_demos(raw_demos: Any) -> list[dict[str, Any]]:
    serialized: list[dict[str, Any]] = []
    for index, demo in enumerate(raw_demos or []):
        data = getattr(demo, "_store", None) or getattr(demo, "__dict__", None) or {}
        serialized.append(
            {
                "id": data.get("id") or f"compiled-demo-{index + 1}",
                "leadContext": data.get("lead_context", ""),
                "topSignal": {
                    "label": None,
                    "value": data.get("top_signal", ""),
                    "category": None,
                    "strength": None,
                    "source": None,
                    "rank": None,
                },
                "draft": {
                    "subject": data.get("subject", ""),
                    "body": data.get("body", ""),
                },
                "priorDraft": data.get("prior_draft", ""),
                "labels": {
                    "cleanAccept": bool(data.get("clean_accept_label")),
                    "replied": bool(data.get("reply_label")),
                    "positiveReply": bool(data.get("workable_reply_label")),
                },
                "objectiveScore": round(
                    OBJECTIVE_WEIGHTS["cleanAccept"] * float(data.get("clean_accept_label", 0.0))
                    + OBJECTIVE_WEIGHTS["workableReply"] * float(data.get("workable_reply_label", 0.0)),
                    4,
                ),
                "angleType": data.get("angle_type"),
            }
        )
    return serialized


def real_mode_artifact(
    args: argparse.Namespace,
    examples: list[dict[str, Any]],
    prompt_version_before: str,
    v3_snapshot: dict[str, Any],
    baseline_row: dict[str, Any],
    projected_version_row: dict[str, Any],
    compiled_at: str,
) -> dict[str, Any]:
    missing = [flag for flag, value in {"--model": args.model, "--teacher-model": args.teacher_model}.items() if not value]
    if missing:
        raise SystemExit(f"Real mode requires {' and '.join(missing)} (or matching DSPY_* env vars).")

    try:
        import dspy  # type: ignore
    except ImportError as exc:
        raise SystemExit("DSPy is not installed. Run `pip install -r requirements-dspy.txt` first.") from exc

    class DraftGeneratorSignature(dspy.Signature):
        """You are a B2B SDR email writer for Vercel. Given a lead context, the top signal, and an earlier draft, write a tighter cold email that leads with the signal, frames a concrete outcome, and ends with a low-friction CTA."""

        lead_context = dspy.InputField(desc="Lead, company, play, timing, and confidence context.")
        top_signal = dspy.InputField(desc="Highest-ranked signal to reference explicitly.")
        prior_draft = dspy.InputField(desc="Existing draft subject and body for context.")
        subject = dspy.OutputField(desc="Seven words or fewer, signal-specific, no question.")
        body = dspy.OutputField(desc="Under 100 words, signal-first, concrete outcome, low-friction CTA.")

    class DraftProgram(dspy.Module):
        def __init__(self) -> None:
            super().__init__()
            self.predict = dspy.Predict(DraftGeneratorSignature)

        def forward(self, lead_context: str, top_signal: str, prior_draft: str) -> Any:
            return self.predict(
                lead_context=lead_context,
                top_signal=top_signal,
                prior_draft=prior_draft,
            )

    def metric(example: Any, prediction: Any, trace: Any = None) -> float:
        subject = getattr(prediction, "subject", "") or ""
        body = getattr(prediction, "body", "") or ""
        example_payload = {
            "topSignal": {"label": None, "value": getattr(example, "top_signal", "")},
        }
        clean = clean_accept_proxy(example_payload, subject, body)
        workable = workable_reply_proxy(example_payload, subject, body)
        return round(
            OBJECTIVE_WEIGHTS["cleanAccept"] * clean + OBJECTIVE_WEIGHTS["workableReply"] * workable,
            4,
        )

    task_lm = dspy.LM(args.model)
    teacher_lm = dspy.LM(args.teacher_model)
    prompt_lm = dspy.LM(args.prompt_model or args.model)
    dspy.configure(lm=task_lm)

    trainset = [
        dspy.Example(
            id=example["id"],
            lead_context=example["leadContext"],
            top_signal=signal_summary(example["topSignal"]),
            prior_draft=example["priorDraft"],
            subject=example["draft"]["subject"],
            body=example["draft"]["body"],
            clean_accept_label=example["labels"]["cleanAccept"],
            reply_label=example["labels"]["replied"],
            workable_reply_label=example["labels"]["positiveReply"],
            angle_type=example["angleType"],
        ).with_inputs("lead_context", "top_signal", "prior_draft")
        for example in examples
    ]

    program = DraftProgram()
    teleprompter = dspy.MIPROv2(
        metric=metric,
        auto=args.auto,
        prompt_model=prompt_lm,
        teacher_settings=dict(lm=teacher_lm),
    )
    optimized_program = teleprompter.compile(
        program,
        trainset=trainset,
        max_bootstrapped_demos=args.max_bootstrapped_demos,
        max_labeled_demos=args.max_labeled_demos,
    )
    optimized_instruction = optimized_program.predict.signature.instructions

    args.save_program.parent.mkdir(parents=True, exist_ok=True)
    optimized_program.save(str(args.save_program))

    demos = serialize_program_demos(getattr(optimized_program.predict, "demos", []))
    if not demos:
        demos = select_mock_demos(examples, args.demos)

    return build_artifact(
        instruction=optimized_instruction or v3_snapshot["instruction"],
        demos=demos[: args.demos],
        compiled_at=compiled_at,
        optimizer="MIPROv2",
        prompt_version_before=prompt_version_before,
        prompt_version_after=v3_snapshot["version"],
        baseline_row=baseline_row,
        projected_version_row=projected_version_row,
        mode="real",
        saved_program_path=path_for_artifact(args.save_program),
        optimized_instruction=optimized_instruction,
    )


def mock_mode_artifact(
    *,
    args: argparse.Namespace,
    examples: list[dict[str, Any]],
    prompt_version_before: str,
    v3_snapshot: dict[str, Any],
    baseline_row: dict[str, Any],
    projected_version_row: dict[str, Any],
    compiled_at: str,
) -> dict[str, Any]:
    demos = select_mock_demos(examples, args.demos)
    return build_artifact(
        instruction=v3_snapshot["instruction"],
        demos=demos,
        compiled_at=compiled_at,
        optimizer="MIPROv2",
        prompt_version_before=prompt_version_before,
        prompt_version_after=v3_snapshot["version"],
        baseline_row=baseline_row,
        projected_version_row=projected_version_row,
        mode="mock",
    )


def main() -> None:
    args = parse_args()
    jobs = load_json(args.dataset)
    snapshots = load_json(args.prompt_snapshots)
    snapshots_by_key = snapshot_index(snapshots)

    prompt_version_before = latest_prompt_version(jobs)
    v3_snapshot = snapshots_by_key.get("v3")
    if not v3_snapshot:
        raise SystemExit("Could not find a v3 prompt snapshot in data/prompt-snapshots.json.")

    examples = [build_example(job) for job in jobs]
    baseline_row = version_row(jobs, prompt_version_before)
    projected_version_row = projected_row(baseline_row, v3_snapshot["version"])
    compiled_at = infer_compiled_at(args, v3_snapshot)

    artifact = (
        mock_mode_artifact(
            args=args,
            examples=examples,
            prompt_version_before=prompt_version_before,
            v3_snapshot=v3_snapshot,
            baseline_row=baseline_row,
            projected_version_row=projected_version_row,
            compiled_at=compiled_at,
        )
        if args.mock
        else real_mode_artifact(
            args=args,
            examples=examples,
            prompt_version_before=prompt_version_before,
            v3_snapshot=v3_snapshot,
            baseline_row=baseline_row,
            projected_version_row=projected_version_row,
            compiled_at=compiled_at,
        )
    )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as handle:
        json.dump(artifact, handle, indent=2)
        handle.write("\n")

    print(json.dumps({
        "out": path_for_artifact(args.out),
        "mode": artifact["mode"],
        "demos": len(artifact["demos"]),
        "promptVersionAfter": artifact["promptVersionAfter"],
    }, indent=2))


if __name__ == "__main__":
    main()
