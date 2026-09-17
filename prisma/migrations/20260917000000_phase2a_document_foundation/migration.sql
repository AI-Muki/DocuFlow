-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'PENDING_PROCESSING', 'PROCESSING', 'PROCESSING_FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT');

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentFolderId" TEXT,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_field_definitions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_field_definitions_pkey" PRIMARY KEY ("id")
);

-- Drop existing documents table if it existed from Phase 1 stub
DROP TABLE IF EXISTS "documents" CASCADE;

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "folderId" TEXT,
    "documentTypeId" TEXT,
    "name" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL DEFAULT 0,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "description" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL DEFAULT 0,
    "checksum" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "changeDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_tags" (
    "documentId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_tags_pkey" PRIMARY KEY ("documentId","tagId")
);

-- CreateTable
CREATE TABLE "document_field_values" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "value" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "folders_organizationId_parentFolderId_name_key" ON "folders"("organizationId", "parentFolderId", "name");
CREATE INDEX "folders_organizationId_idx" ON "folders"("organizationId");
CREATE INDEX "folders_parentFolderId_idx" ON "folders"("parentFolderId");
CREATE INDEX "folders_createdById_idx" ON "folders"("createdById");
CREATE INDEX "folders_deletedAt_idx" ON "folders"("deletedAt");
CREATE INDEX "folders_organizationId_parentFolderId_deletedAt_idx" ON "folders"("organizationId", "parentFolderId", "deletedAt");

CREATE UNIQUE INDEX "document_types_organizationId_name_key" ON "document_types"("organizationId", "name");
CREATE INDEX "document_types_organizationId_idx" ON "document_types"("organizationId");

CREATE UNIQUE INDEX "document_field_definitions_documentTypeId_key_key" ON "document_field_definitions"("documentTypeId", "key");
CREATE INDEX "document_field_definitions_organizationId_idx" ON "document_field_definitions"("organizationId");
CREATE INDEX "document_field_definitions_documentTypeId_idx" ON "document_field_definitions"("documentTypeId");

CREATE INDEX "documents_organizationId_idx" ON "documents"("organizationId");
CREATE INDEX "documents_folderId_idx" ON "documents"("folderId");
CREATE INDEX "documents_documentTypeId_idx" ON "documents"("documentTypeId");
CREATE INDEX "documents_ownerId_idx" ON "documents"("ownerId");
CREATE INDEX "documents_createdById_idx" ON "documents"("createdById");
CREATE INDEX "documents_createdAt_idx" ON "documents"("createdAt");
CREATE INDEX "documents_updatedAt_idx" ON "documents"("updatedAt");
CREATE INDEX "documents_deletedAt_idx" ON "documents"("deletedAt");
CREATE INDEX "documents_status_idx" ON "documents"("status");
CREATE INDEX "documents_organizationId_status_idx" ON "documents"("organizationId", "status");
CREATE INDEX "documents_organizationId_folderId_deletedAt_idx" ON "documents"("organizationId", "folderId", "deletedAt");
CREATE INDEX "documents_organizationId_documentTypeId_idx" ON "documents"("organizationId", "documentTypeId");
CREATE INDEX "documents_organizationId_ownerId_idx" ON "documents"("organizationId", "ownerId");

CREATE UNIQUE INDEX "document_versions_documentId_versionNumber_key" ON "document_versions"("documentId", "versionNumber");
CREATE INDEX "document_versions_documentId_idx" ON "document_versions"("documentId");
CREATE INDEX "document_versions_uploadedById_idx" ON "document_versions"("uploadedById");
CREATE INDEX "document_versions_createdAt_idx" ON "document_versions"("createdAt");

CREATE UNIQUE INDEX "tags_organizationId_name_key" ON "tags"("organizationId", "name");
CREATE INDEX "tags_organizationId_idx" ON "tags"("organizationId");

CREATE INDEX "document_tags_documentId_idx" ON "document_tags"("documentId");
CREATE INDEX "document_tags_tagId_idx" ON "document_tags"("tagId");

CREATE UNIQUE INDEX "document_field_values_documentId_fieldDefinitionId_key" ON "document_field_values"("documentId", "fieldDefinitionId");
CREATE INDEX "document_field_values_documentId_idx" ON "document_field_values"("documentId");
CREATE INDEX "document_field_values_fieldDefinitionId_idx" ON "document_field_values"("fieldDefinitionId");

-- AddForeignKeys
ALTER TABLE "folders" ADD CONSTRAINT "folders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "folders" ADD CONSTRAINT "folders_parentFolderId_fkey" FOREIGN KEY ("parentFolderId") REFERENCES "folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "folders" ADD CONSTRAINT "folders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_types" ADD CONSTRAINT "document_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_field_definitions" ADD CONSTRAINT "document_field_definitions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_field_definitions" ADD CONSTRAINT "document_field_definitions_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tags" ADD CONSTRAINT "tags_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_field_values" ADD CONSTRAINT "document_field_values_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_field_values" ADD CONSTRAINT "document_field_values_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "document_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
