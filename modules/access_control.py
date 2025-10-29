"""Utilities for evaluating knowledge access based on user group membership."""

from __future__ import annotations

from typing import Iterable, List, Set

from modules.database import Knowledge, UserGroup


def get_user_group_ids(user_id: str | None) -> Set[int]:
    """Return the set of group IDs a user belongs to."""
    if not user_id:
        return set()

    rows = (
        UserGroup.query.with_entities(UserGroup.group_id)
        .filter_by(user_id=user_id)
        .all()
    )
    return {row.group_id for row in rows}


def knowledge_is_accessible(knowledge: Knowledge, user_group_ids: Set[int]) -> bool:
    """Determine whether a knowledge base is accessible to a user."""
    groups = list(getattr(knowledge, "groups", []) or [])
    if not groups:
        # No group restriction means public access
        return True

    knowledge_group_ids = {
        getattr(group, "group_id", None) for group in groups if getattr(group, "group_id", None) is not None
    }
    if not knowledge_group_ids:
        return True
    return bool(user_group_ids.intersection(knowledge_group_ids))


def filter_accessible_knowledges(
    knowledges: Iterable[Knowledge],
    user_group_ids: Set[int],
) -> List[Knowledge]:
    """Return only the knowledges a user is allowed to access."""
    return [knowledge for knowledge in knowledges if knowledge_is_accessible(knowledge, user_group_ids)]
