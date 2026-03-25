const cron = require('node-cron');

class TaskScheduler {
    constructor() {
        this.tasks = new Map();
        this.running = false;
    }

    start() {
        this.running = true;
        console.log('Task scheduler started');
    }

    stop() {
        this.running = false;
        // Stop all running tasks
        for (const [id, task] of this.tasks) {
            if (task.cronJob) {
                task.cronJob.stop();
            }
        }
        console.log('Task scheduler stopped');
    }

    scheduleTask(id, cronExpression, taskFunction, options = {}) {
        if (!this.running) {
            return { error: 'Scheduler not running' };
        }

        // Validate cron expression
        if (!cron.validate(cronExpression)) {
            return { error: 'Invalid cron expression' };
        }

        // Stop existing task if it exists
        if (this.tasks.has(id)) {
            this.tasks.get(id).cronJob.stop();
        }

        // Create new cron job
        const cronJob = cron.schedule(cronExpression, async () => {
            try {
                console.log(`Executing scheduled task: ${id}`);
                await taskFunction();
                console.log(`Task ${id} completed successfully`);
            } catch (error) {
                console.error(`Task ${id} failed:`, error);
                if (options.onError) {
                    options.onError(error);
                }
            }
        }, {
            scheduled: options.immediate || false
        });

        this.tasks.set(id, {
            cronJob,
            expression: cronExpression,
            function: taskFunction,
            options
        });

        return { success: true, message: `Task ${id} scheduled` };
    }

    unscheduleTask(id) {
        const task = this.tasks.get(id);
        if (task) {
            task.cronJob.stop();
            this.tasks.delete(id);
            return { success: true, message: `Task ${id} unscheduled` };
        }
        return { error: `Task ${id} not found` };
    }

    listTasks() {
        const taskList = [];
        for (const [id, task] of this.tasks) {
            taskList.push({
                id,
                expression: task.expression,
                running: task.cronJob.running
            });
        }
        return taskList;
    }

    runTaskNow(id) {
        const task = this.tasks.get(id);
        if (task) {
            task.function().catch(error => {
                console.error(`Manual task ${id} execution failed:`, error);
            });
            return { success: true, message: `Task ${id} executed manually` };
        }
        return { error: `Task ${id} not found` };
    }
}

module.exports = TaskScheduler;