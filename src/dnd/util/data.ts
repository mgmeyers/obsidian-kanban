import { Nestable, Path } from "../types";
import update, { Spec } from "immutability-helper";
import { getSiblingDirection, SiblingDirection } from "./path";

export function getEntityFromPath(root: Nestable, path: Path): Nestable {
  const step = !!path.length ? path[0] : null;

  if (step !== null && root.children && root.children[step]) {
    return getEntityFromPath(root.children[step], path.slice(1));
  }

  return root;
}

export function buildUpdateMutation(path: Path, mutation: Spec<Nestable>) {
  for (let i = path.length - 2; i >= 0; i--) {
    mutation = {
      children: {
        [path[i]]: mutation,
      },
    };
  }

  return mutation;
}

export function buildRemoveMutation(path: Path) {
  return buildUpdateMutation(path, {
    children: {
      $splice: [[path[path.length - 1], 1]],
    },
  });
}

export function buildInsertMutation(
  destination: Path,
  entity: Nestable,
  destinationModifier: number = 0
) {
  return buildUpdateMutation(destination, {
    children: {
      $splice: [
        [destination[destination.length - 1] + destinationModifier, 0, entity],
      ],
    },
  });
}

export function buildAppendMutation(destination: Path, entities: Nestable[]) {
  return buildUpdateMutation(destination, {
    children: {
      $push: entities,
    },
  });
}

export function buildPrependMutation(destination: Path, entities: Nestable[]) {
  return buildUpdateMutation(destination, {
    children: {
      $unshift: entities,
    },
  });
}

export function moveEntity(root: Nestable, source: Path, destination: Path) {
  const entity = getEntityFromPath(root, source);
  const siblingDirection = getSiblingDirection(source, destination);

  let destinationModifier =
    siblingDirection === SiblingDirection.After ? -1 : 0;

  const removeMutation = buildRemoveMutation(source);
  const insertMutation = buildInsertMutation(
    destination,
    entity,
    destinationModifier
  );

  return update(update(root, removeMutation), insertMutation);
}

export function removeEntity(root: Nestable, target: Path) {
  return update(root, buildRemoveMutation(target));
}

export function insertEntity(
  root: Nestable,
  destination: Path,
  entity: Nestable
) {
  return update(root, buildInsertMutation(destination, entity));
}

export function appendEntities(
  root: Nestable,
  destination: Path,
  entities: Nestable[]
) {
  return update(root, buildAppendMutation(destination, entities));
}

export function updateEntity(
  root: Nestable,
  path: Path,
  mutation: Spec<Nestable>
) {
  return update(root, buildUpdateMutation(path, mutation));
}
