import * as fs from 'fs';
import { ParsedSection, SectionType, ImplementationStatus, ParseOptions, ISpecParser, ISpecFileManager } from './types';

/**
 * Parses spec files and extracts sections, requirements, and implementations
 */
export class SpecParser implements ISpecParser {
    private specFileManager: ISpecFileManager;

    constructor(specFileManager: ISpecFileManager) {
        this.specFileManager = specFileManager;
    }

    /**
     * Parses all sections from the spec file
     * @param filePath Path to the spec file
     * @returns Array of parsed sections
     */
    parseAllSections(filePath: string): ParsedSection[] {
        return this.parseFile(filePath, { filter: 'all' });
    }

    /**
     * Parses requirements sections from the spec file
     * @param filePath Path to the spec file
     * @returns Array of requirement sections
     */
    parseRequirements(filePath: string): ParsedSection[] {
        return this.parseFile(filePath, {
            filter: 'requirements',
            sectionKeywords: [
                'user', 'scenario', 'requirement', 'test', 'functional'
            ]
        });
    }

    /**
     * Parses implementation sections from the spec file
     * @param filePath Path to the spec file
     * @returns Array of implementation sections
     */
    parseImplementations(filePath: string): ParsedSection[] {
        return this.parseFile(filePath, {
            filter: 'implementations',
            includeStatus: true,
            sectionKeywords: [
                'review', 'acceptance', 'checklist', 'implementation', 'development', 'task'
            ]
        });
    }

    /**
     * Core parsing method that handles different section types
     * @param filePath Path to the spec file
     * @param options Parsing options
     * @returns Array of parsed sections
     */
    private parseFile(filePath: string, options: ParseOptions): ParsedSection[] {
        if (!fs.existsSync(filePath)) {
            return [];
        }

        const content = this.specFileManager.getContent();
        if (!content) {
            return [];
        }

        const lines = content.split(/\r?\n/);
        const sections: ParsedSection[] = [];
        
        let currentSection: string | undefined = undefined;
        let currentSubsection: string | undefined = undefined;
        let inTargetSection = options.filter === 'all';
        
        // Use sets to prevent duplicates
        const sectionSet = new Set<string>();
        const subsectionSet = new Set<string>();
        const subitemSet = new Set<string>();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Handle ## Section headers
            const sectionMatch = line.match(/^##\s+(.+)/);
            if (sectionMatch) {
                const sectionName = sectionMatch[1].trim();
                
                if (options.filter !== 'all') {
                    inTargetSection = this.isSectionMatch(sectionName, options.sectionKeywords || []);
                }

                if (inTargetSection) {
                    currentSection = sectionName;
                    currentSubsection = undefined;

                    if (!sectionSet.has(currentSection)) {
                        sections.push(this.createSection(currentSection, i, 'section'));
                        sectionSet.add(currentSection);
                    }
                } else {
                    currentSection = undefined;
                    currentSubsection = undefined;
                }
                continue;
            }

            if (!inTargetSection || !currentSection) {
                continue;
            }

            // Handle ### Subsection headers
            const subsectionMatch = line.match(/^###\s+(.+)/);
            if (subsectionMatch) {
                currentSubsection = subsectionMatch[1].trim();
                const subKey = `${currentSection}::${currentSubsection}`;

                if (!subsectionSet.has(subKey)) {
                    sections.push(this.createSection(currentSubsection, i, 'subsection', currentSection));
                    subsectionSet.add(subKey);
                }
                continue;
            }

            // Handle list items (bullets, numbers, checklists)
            if (currentSubsection) {
                const itemMatch = line.match(/^\s*([-*+]|\d+\.|\[[x ]\])\s+(.+)/);
                if (itemMatch) {
                    let itemLabel = itemMatch[2].trim();
                    let status: ImplementationStatus | undefined;

                    // Extract status from checkbox if needed
                    if (options.includeStatus) {
                        const checkboxMatch = itemLabel.match(/^\[([x ])\]\s*(.+)/);
                        if (checkboxMatch) {
                            status = checkboxMatch[1] === 'x' ? 'completed' : 'pending';
                            itemLabel = checkboxMatch[2];
                        }
                    }

                    // Remove any remaining checkbox syntax
                    itemLabel = itemLabel.replace(/^\[[ x]\]\s*/, '');

                    const itemKey = `${currentSection}::${currentSubsection}::${itemLabel}`;
                    if (itemLabel && !subitemSet.has(itemKey)) {
                        const section = this.createSection(itemLabel, i, 'subitem', currentSubsection);
                        if (status) {
                            section.status = status;
                        }
                        sections.push(section);
                        subitemSet.add(itemKey);
                    }
                }
            }
        }

        return sections;
    }

    /**
     * Creates a parsed section object
     * @param label Section label
     * @param line Line number
     * @param type Section type
     * @param parent Parent section name
     * @returns ParsedSection object
     */
    private createSection(label: string, line: number, type: SectionType, parent?: string): ParsedSection {
        const section: ParsedSection = {
            label,
            line,
            type,
            parent,
            contextValue: type
        };

        return section;
    }

    /**
     * Checks if a section name matches any of the provided keywords
     * @param sectionName Name of the section
     * @param keywords Array of keywords to match against
     * @returns True if section matches, false otherwise
     */
    private isSectionMatch(sectionName: string, keywords: string[]): boolean {
        const lowerSectionName = sectionName.toLowerCase();
        return keywords.some(keyword => lowerSectionName.includes(keyword.toLowerCase()));
    }

    /**
     * Gets the total count of sections by type
     * @param sections Array of parsed sections
     * @returns Object with counts by section type
     */
    getSectionCounts(sections: ParsedSection[]): Record<SectionType, number> {
        return sections.reduce((counts, section) => {
            counts[section.type] = (counts[section.type] || 0) + 1;
            return counts;
        }, {} as Record<SectionType, number>);
    }

    /**
     * Filters sections by parent
     * @param sections Array of parsed sections
     * @param parentName Name of the parent section
     * @returns Filtered array of sections
     */
    filterByParent(sections: ParsedSection[], parentName: string): ParsedSection[] {
        return sections.filter(section => section.parent === parentName);
    }

    /**
     * Gets sections by type
     * @param sections Array of parsed sections
     * @param type Section type to filter by
     * @returns Filtered array of sections
     */
    filterByType(sections: ParsedSection[], type: SectionType): ParsedSection[] {
        return sections.filter(section => section.type === type);
    }
}