import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
});

Handlebars.registerHelper('formatCurrency', (amount: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
});

export interface EmailTemplateData {
    userName?: string;
    businessName?: string;
    documentName?: string;
    amount?: number;
    status?: string;
    message?: string;
    actionUrl?: string;
    actionText?: string;
    [key: string]: any;
}

export class EmailTemplateEngine {
    private templatesDir: string;
    private baseTemplate: HandlebarsTemplateDelegate | null = null;

    constructor() {
        this.templatesDir = path.join(__dirname, '../templates/emails');
        this.ensureTemplatesDir();
        this.loadBaseTemplate();
    }

    private ensureTemplatesDir() {
        if (!fs.existsSync(this.templatesDir)) {
            fs.mkdirSync(this.templatesDir, { recursive: true });
        }
    }

    private loadBaseTemplate() {
        const baseTemplatePath = path.join(this.templatesDir, 'base.hbs');
        if (fs.existsSync(baseTemplatePath)) {
            const templateContent = fs.readFileSync(baseTemplatePath, 'utf-8');
            this.baseTemplate = Handlebars.compile(templateContent);
        }
    }

    private getTemplate(templateName: string): HandlebarsTemplateDelegate {
        const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template ${templateName} not found at ${templatePath}`);
        }

        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        return Handlebars.compile(templateContent);
    }

    public render(templateName: string, data: EmailTemplateData): string {
        const template = this.getTemplate(templateName);
        const content = template(data);

        // If base template exists, wrap content in it
        if (this.baseTemplate) {
            return this.baseTemplate({ ...data, content });
        }

        return content;
    }

    public renderCustom(htmlContent: string, data: EmailTemplateData): string {
        const template = Handlebars.compile(htmlContent);
        const content = template(data);

        // Wrap in base template if available
        if (this.baseTemplate) {
            return this.baseTemplate({ ...data, content });
        }

        return content;
    }
}

export const emailTemplateEngine = new EmailTemplateEngine();
