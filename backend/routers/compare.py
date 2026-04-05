from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db import crud
from backend.models.schemas import (
    DrugComparisonResponse, DrugComparisonRow,
    PlanComparisonResponse, PlanDiffEntry, HealthPlanSummary, ChangeLogEntry
)

router = APIRouter(prefix="/compare", tags=["compare"])


@router.get("/drug/{drug_name}", response_model=DrugComparisonResponse)
def compare_drug(
    drug_name: str,
    plan_ids: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    drugs = crud.search_drug(db, drug_name)
    if not drugs:
        raise HTTPException(status_code=404, detail="Drug not found")

    drug = drugs[0]
    pid_list = [int(p) for p in plan_ids.split(",")] if plan_ids else None
    rows = crud.get_coverage_for_drug(db, [drug.id], plan_ids=pid_list)

    comparisons = []
    for row in rows:
        comparisons.append(DrugComparisonRow(
            plan_id=row["plan_id"],
            plan_name=row["plan_name"],
            coverage_status=row["coverage_status"],
            tier=row.get("tier"),
            requires_prior_auth=row["requires_prior_auth"],
            requires_step_therapy=row["requires_step_therapy"],
            prior_auth_criteria=row.get("prior_auth_criteria", []),
            step_therapy_drugs=row.get("step_therapy_drugs", []),
            quantity_limit=row.get("quantity_limit"),
            age_restriction=row.get("age_restriction"),
            notes=row.get("notes"),
            benefit_side=row.get("benefit_side", "unknown"),
            data_completeness=row.get("data_completeness", "low"),
            benefit_side_note=row.get("benefit_side_note"),
        ))

    return DrugComparisonResponse(
        drug_brand_name=drug.brand_name,
        drug_generic_name=drug.generic_name,
        drug_class=drug.drug_class,
        comparisons=comparisons,
    )


@router.get("/plans", response_model=PlanComparisonResponse)
def compare_plans(
    plan_id_a: int = Query(...),
    plan_id_b: int = Query(...),
    db: Session = Depends(get_db),
):
    plan_a = crud.get_plan(db, plan_id_a)
    plan_b = crud.get_plan(db, plan_id_b)
    if not plan_a or not plan_b:
        raise HTTPException(status_code=404, detail="One or both plans not found")

    rows_a = crud.get_all_coverage(db, plan_ids=[plan_id_a])
    rows_b = crud.get_all_coverage(db, plan_ids=[plan_id_b])

    drugs_a = {r["drug_generic_name"]: r for r in rows_a}
    drugs_b = {r["drug_generic_name"]: r for r in rows_b}

    all_drugs = set(drugs_a.keys()) | set(drugs_b.keys())
    only_a = sorted(set(drugs_a.keys()) - set(drugs_b.keys()))
    only_b = sorted(set(drugs_b.keys()) - set(drugs_a.keys()))

    differences: List[PlanDiffEntry] = []
    compare_fields = ["coverage_status", "tier", "requires_prior_auth",
                      "requires_step_therapy", "quantity_limit", "benefit_side"]

    for drug_name in sorted(all_drugs):
        if drug_name in drugs_a and drug_name in drugs_b:
            row_a = drugs_a[drug_name]
            row_b = drugs_b[drug_name]
            for field in compare_fields:
                val_a = str(row_a.get(field, "") or "")
                val_b = str(row_b.get(field, "") or "")
                if val_a != val_b:
                    differences.append(PlanDiffEntry(
                        drug_generic_name=drug_name,
                        field=field,
                        plan_a_value=val_a,
                        plan_b_value=val_b,
                    ))

    return PlanComparisonResponse(
        plan_a=HealthPlanSummary.model_validate(plan_a),
        plan_b=HealthPlanSummary.model_validate(plan_b),
        differences=differences,
        only_in_plan_a=only_a,
        only_in_plan_b=only_b,
    )


@router.get("/changes", response_model=List[ChangeLogEntry])
def get_changes(
    plan_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    rows = crud.get_changes(db, plan_id=plan_id)
    return [ChangeLogEntry(**r) for r in rows]
