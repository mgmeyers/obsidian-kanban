# Dynamic Task Query Lanes

This feature allows you to create Kanban lanes that are automatically populated with tasks from queries, similar to the Tasks plugin query blocks.

## How to Use

Add a tasks query block in your lane header to make it dynamic:

```markdown
    ## Today
    ```tasks
    not done
    due today
    ```

    ## Another Lane
    ```tasks
    done
    due before tomorrow
    ```

    ## Manual Tasks
    This lane works normally - you can add tasks manually
    - [ ] Regular task
    - [x] Completed task
```

## Features

### Dynamic Population
- Lanes with query blocks automatically populate with matching tasks
- Tasks are pulled from across your vault based on the query criteria
- Queries use the same syntax as the Tasks plugin

### Manual Override
- You can still add tasks manually to any lane, including query lanes
- Manual tasks appear alongside query results
- Manual tasks are preserved when the board is saved

### Smart Movement
- When you move a task to a query lane, its properties are automatically updated to match the query
- Moving a task to a "due today" lane will add today's date
- Moving to a "done" lane will mark the task as completed
- Moving to a "not done" lane will mark the task as incomplete

### Query Examples

#### Due Date Queries
```markdown
    ```tasks
    not done
    due today
    ```

    ```tasks
    not done
    due this week
    ```
```

#### Status Queries  
```markdown
    ```tasks
    done
    ```

    ```tasks
    not done
    ```
```

#### Priority Queries
```markdown
    ```tasks
    not done
    priority high
    ```
```

#### Combined Queries
```markdown
    ```tasks
    not done
    due today
    priority high
    ```
```

## Technical Details

### Lane Data Structure
- Lanes now support a `query` field in their data
- Query results are marked with `fromQuery: true` to distinguish from manual tasks
- Only manual tasks are serialized back to markdown to avoid duplication

### Refresh Behavior
- Dynamic lanes refresh when file metadata changes
- Manual refresh can be triggered by calling `refreshDynamicLanes()`
- Query results update automatically when underlying tasks change

### Compatibility
- Requires the Tasks plugin to be installed and enabled
- Falls back gracefully if Tasks plugin is not available
- Existing boards continue to work unchanged

> [!WARNING]
> Is scheduled at Tasks plugin roadmap a [future feature to configure the datetime format](https://github.com/obsidian-tasks-group/obsidian-tasks/issues/3372). This may affect how due dates are interpreted in queries. There's a pin at `src/parsers/helpers/taskQuery.ts:119` and I'll address to it in the future commits.
