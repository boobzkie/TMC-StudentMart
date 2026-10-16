-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: 127.0.0.1    Database: student_marketplace
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `student_marketplace`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `student_marketplace` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;

USE `student_marketplace`;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` bigint(20) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache`
--

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
INSERT INTO `cache` VALUES ('laravel-cache-5c785c036466adea360111aa28563bfd556b5fba','i:1;',1792103512),('laravel-cache-5c785c036466adea360111aa28563bfd556b5fba:timer','i:1792103512;',1792103512),('laravel-cache-f1abd670358e036c31296e66b3b66c382ac00812','i:1;',1792102464),('laravel-cache-f1abd670358e036c31296e66b3b66c382ac00812:timer','i:1792102464;',1792102464);
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` bigint(20) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache_locks`
--

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `categories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_name_unique` (`name`),
  KEY `categories_status_index` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (6,'UNIFORM',NULL,'active','2026-09-30 10:39:10','2026-09-30 10:39:10'),(7,'BOOK',NULL,'active','2026-09-30 10:39:40','2026-10-11 09:22:02'),(8,'ELECTRONICS',NULL,'active','2026-09-30 10:40:00','2026-09-30 10:40:00'),(9,'Clothes','any kind','active','2026-10-11 20:36:32','2026-10-11 20:36:32');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `commission_rates`
--

DROP TABLE IF EXISTS `commission_rates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `commission_rates` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `rate_percent` decimal(7,4) NOT NULL,
  `effective_at` timestamp(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `configured_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `commission_rates_configured_by_foreign` (`configured_by`),
  KEY `commission_rates_effective_at_index` (`effective_at`),
  CONSTRAINT `commission_rates_configured_by_foreign` FOREIGN KEY (`configured_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `commission_rates`
--

LOCK TABLES `commission_rates` WRITE;
/*!40000 ALTER TABLE `commission_rates` DISABLE KEYS */;
INSERT INTO `commission_rates` VALUES (1,2.0000,'2026-10-12 20:18:13.000000',1,'2026-10-12 20:18:13','2026-10-12 20:18:13');
/*!40000 ALTER TABLE `commission_rates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `complaints`
--

DROP TABLE IF EXISTS `complaints`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `complaints` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `product_id` bigint(20) unsigned DEFAULT NULL,
  `subject` varchar(150) NOT NULL,
  `description` text NOT NULL,
  `status` enum('pending','in_review','resolved','rejected') NOT NULL DEFAULT 'pending',
  `admin_response` text DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `staff_note` text DEFAULT NULL,
  `handled_by` bigint(20) unsigned DEFAULT NULL,
  `handled_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `complaints_status_index` (`status`),
  KEY `complaints_user_id_index` (`user_id`),
  KEY `complaints_product_id_index` (`product_id`),
  KEY `complaints_created_at_index` (`created_at`),
  KEY `complaints_handled_by_foreign` (`handled_by`),
  CONSTRAINT `complaints_handled_by_foreign` FOREIGN KEY (`handled_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `complaints_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL,
  CONSTRAINT `complaints_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `complaints`
--

LOCK TABLES `complaints` WRITE;
/*!40000 ALTER TABLE `complaints` DISABLE KEYS */;
/*!40000 ALTER TABLE `complaints` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` varchar(255) NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`),
  KEY `failed_jobs_connection_queue_failed_at_index` (`connection`,`queue`,`failed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_batches`
--

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` smallint(5) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2026_08_28_162359_create_products_table',1),(5,'2026_08_28_170647_create_personal_access_tokens_table',1),(6,'2026_08_30_165600_add_student_fields_to_users_table',1),(7,'2026_09_07_142754_add_role_status_profile_picture_to_users_table',1),(8,'2026_09_07_171326_add_fields_to_products_table',1),(9,'2026_09_23_180000_create_categories_table',1),(10,'2026_09_23_154512_create_complaints_table',2),(11,'2026_09_26_000001_make_student_id_nullable_on_users_table',3),(12,'2026_09_26_000002_add_course_to_users_table',4),(13,'2026_09_26_000003_create_staff_profiles_and_application_events_tables',4),(14,'2026_10_02_000000_create_product_images_table',5),(15,'2026_10_05_000001_add_category_id_to_products_table',6),(16,'2026_10_11_000003_add_last_seen_at_to_staff_profiles_table',7),(17,'2026_10_11_000001_create_product_moderation_events_table',8),(18,'2026_10_11_000002_add_staff_handling_fields_to_complaints_table',8),(19,'2026_10_11_000004_create_marketplace_orders_tables',9),(20,'2026_10_12_000001_create_order_idempotency_keys_table',10),(21,'2026_10_12_000002_create_notifications_table',11),(22,'2026_10_12_000001_create_product_warnings_table',12),(23,'2026_10_12_000003_add_stock_and_product_history',13),(24,'2026_10_12_000004_preserve_products_when_seller_is_deleted',13),(26,'2026_10_12_000006_create_order_options_and_add_order_agreements',14),(27,'2026_10_12_000007_create_commission_tracking_tables',15),(28,'2026_10_12_000008_add_social_links_to_users_table',16),(29,'2026_10_13_000001_add_share_contact_info_to_users_table',17),(30,'2026_10_14_000001_add_product_attributes_and_variants',18),(31,'2026_10_14_102649_add_seller_response_deadline_to_orders_table',19),(32,'2026_10_15_220000_add_payment_status_to_orders',20);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` char(36) NOT NULL,
  `type` varchar(255) NOT NULL,
  `notifiable_type` varchar(255) NOT NULL,
  `notifiable_id` bigint(20) unsigned NOT NULL,
  `data` text NOT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_notifiable_type_notifiable_id_index` (`notifiable_type`,`notifiable_id`),
  KEY `notifications_owner_read_index` (`notifiable_type`,`notifiable_id`,`read_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES ('2212f446-1b1c-4b53-99cc-1eb9e3813eef','App\\Notifications\\OrderEventNotification','App\\Models\\User',15,'{\"event\":\"order_placed\",\"title\":\"New order request\",\"message\":\"Order TMC-261015-7WJM9G0O was placed and is waiting for your review.\",\"order_id\":9,\"order_number\":\"TMC-261015-7WJM9G0O\",\"status\":\"pending\"}','2026-10-14 21:06:17','2026-10-14 20:54:15','2026-10-14 21:06:17'),('2ab6300f-432b-4339-bc74-a8c3568c5d8a','App\\Notifications\\OrderEventNotification','App\\Models\\User',15,'{\"event\":\"order_placed\",\"title\":\"New order request\",\"message\":\"Order TMC-261015-2UX3SUN0 was placed and is waiting for your review.\",\"order_id\":10,\"order_number\":\"TMC-261015-2UX3SUN0\",\"status\":\"pending\"}','2026-10-15 13:20:57','2026-10-14 21:15:19','2026-10-15 13:20:57'),('38147401-06fe-4b23-b5fe-c1832e37af52','App\\Notifications\\OrderEventNotification','App\\Models\\User',15,'{\"event\":\"order_accepted\",\"title\":\"Order accepted\",\"message\":\"The seller accepted order TMC-261015-ZR6PWMAR.\",\"order_id\":11,\"order_number\":\"TMC-261015-ZR6PWMAR\",\"status\":\"confirmed\"}',NULL,'2026-10-15 14:31:11','2026-10-15 14:31:11'),('44b41748-af3d-45af-b805-846c5b4d3611','App\\Notifications\\OrderEventNotification','App\\Models\\User',16,'{\"event\":\"order_placed\",\"title\":\"New order request\",\"message\":\"Order TMC-261015-ZR6PWMAR was placed and is waiting for your review.\",\"order_id\":11,\"order_number\":\"TMC-261015-ZR6PWMAR\",\"status\":\"pending\"}',NULL,'2026-10-15 14:13:25','2026-10-15 14:13:25'),('86243a0a-c36d-437e-bf33-8545d3a235ed','App\\Notifications\\OrderEventNotification','App\\Models\\User',16,'{\"event\":\"order_accepted\",\"title\":\"Order accepted\",\"message\":\"The seller accepted order TMC-261015-2UX3SUN0.\",\"order_id\":10,\"order_number\":\"TMC-261015-2UX3SUN0\",\"status\":\"confirmed\"}',NULL,'2026-10-15 14:30:04','2026-10-15 14:30:04'),('9276d80f-98f9-4eb3-87d7-d60de055819e','App\\Notifications\\OrderEventNotification','App\\Models\\User',16,'{\"event\":\"order_ready_for_pickup\",\"title\":\"Ready for pickup\",\"message\":\"Order TMC-261015-7WJM9G0O is ready for pickup.\",\"order_id\":9,\"order_number\":\"TMC-261015-7WJM9G0O\",\"status\":\"ready_for_pickup\"}',NULL,'2026-10-14 21:06:53','2026-10-14 21:06:53'),('977e4741-ae7a-4c74-be98-bacf46a1ef76','App\\Notifications\\OrderEventNotification','App\\Models\\User',15,'{\"event\":\"order_ready_for_pickup\",\"title\":\"Ready for pickup\",\"message\":\"Order TMC-261015-ZR6PWMAR is ready for pickup.\",\"order_id\":11,\"order_number\":\"TMC-261015-ZR6PWMAR\",\"status\":\"ready_for_pickup\"}',NULL,'2026-10-15 14:31:15','2026-10-15 14:31:15'),('b8c5da53-e9d5-4a7c-968d-22ad14996dbc','App\\Notifications\\OrderEventNotification','App\\Models\\User',16,'{\"event\":\"order_completed\",\"title\":\"Order completed\",\"message\":\"The seller marked order TMC-261015-7WJM9G0O as completed.\",\"order_id\":9,\"order_number\":\"TMC-261015-7WJM9G0O\",\"status\":\"completed\"}',NULL,'2026-10-14 21:07:07','2026-10-14 21:07:07'),('c92d4d15-9f4e-48ef-a6ee-969e88c5f13b','App\\Notifications\\OrderEventNotification','App\\Models\\User',16,'{\"event\":\"order_accepted\",\"title\":\"Order accepted\",\"message\":\"The seller accepted order TMC-261015-7WJM9G0O.\",\"order_id\":9,\"order_number\":\"TMC-261015-7WJM9G0O\",\"status\":\"confirmed\"}',NULL,'2026-10-14 21:06:43','2026-10-14 21:06:43'),('fe294620-e8a4-4b73-b4cc-28aa36a93385','App\\Notifications\\OrderEventNotification','App\\Models\\User',15,'{\"event\":\"order_completed\",\"title\":\"Order completed\",\"message\":\"The seller marked order TMC-261015-ZR6PWMAR as completed.\",\"order_id\":11,\"order_number\":\"TMC-261015-ZR6PWMAR\",\"status\":\"completed\"}',NULL,'2026-10-15 14:31:19','2026-10-15 14:31:19');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_commissions`
--

DROP TABLE IF EXISTS `order_commissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_commissions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `commission_rate_id` bigint(20) unsigned DEFAULT NULL,
  `sale_amount` decimal(10,2) NOT NULL,
  `rate_percent` decimal(7,4) DEFAULT NULL,
  `commission_amount` decimal(10,2) DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'unconfigured',
  `earned_at` timestamp NULL DEFAULT NULL,
  `collected_at` timestamp NULL DEFAULT NULL,
  `collected_by` bigint(20) unsigned DEFAULT NULL,
  `collection_reference` varchar(120) DEFAULT NULL,
  `collection_note` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_commissions_order_id_unique` (`order_id`),
  KEY `order_commissions_commission_rate_id_foreign` (`commission_rate_id`),
  KEY `order_commissions_collected_by_foreign` (`collected_by`),
  KEY `order_commissions_status_index` (`status`),
  KEY `order_commissions_earned_at_index` (`earned_at`),
  CONSTRAINT `order_commissions_collected_by_foreign` FOREIGN KEY (`collected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `order_commissions_commission_rate_id_foreign` FOREIGN KEY (`commission_rate_id`) REFERENCES `commission_rates` (`id`) ON DELETE SET NULL,
  CONSTRAINT `order_commissions_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_commissions`
--

LOCK TABLES `order_commissions` WRITE;
/*!40000 ALTER TABLE `order_commissions` DISABLE KEYS */;
INSERT INTO `order_commissions` VALUES (1,9,1,200.00,2.0000,4.00,'uncollected','2026-10-14 21:07:07',NULL,NULL,NULL,NULL,'2026-10-14 21:07:07','2026-10-14 21:07:07'),(2,11,1,125.00,2.0000,2.50,'uncollected','2026-10-15 14:31:19',NULL,NULL,NULL,NULL,'2026-10-15 14:31:19','2026-10-15 14:31:19');
/*!40000 ALTER TABLE `order_commissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_idempotency_keys`
--

DROP TABLE IF EXISTS `order_idempotency_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_idempotency_keys` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `buyer_id` bigint(20) unsigned NOT NULL,
  `idempotency_key` varchar(128) NOT NULL,
  `request_hash` char(64) NOT NULL,
  `order_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`order_ids`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_idempotency_buyer_key_unique` (`buyer_id`,`idempotency_key`),
  CONSTRAINT `order_idempotency_keys_buyer_id_foreign` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_idempotency_keys`
--

LOCK TABLES `order_idempotency_keys` WRITE;
/*!40000 ALTER TABLE `order_idempotency_keys` DISABLE KEYS */;
INSERT INTO `order_idempotency_keys` VALUES (1,16,'bfa505503f89651926a8a618a34300bbb8ccbb1e21e95a5d98e0dc64f426e101','024eb7e50dd1f089f2f33a9a1f9205cc5a1983eb448f2baff042eb450fedd882','[9]','2026-10-14 20:54:15','2026-10-14 20:54:15'),(2,16,'b40eef294b63ca5850a0772b253d4c47f471fba0854833f9b1420719bf306dbc','024eb7e50dd1f089f2f33a9a1f9205cc5a1983eb448f2baff042eb450fedd882','[10]','2026-10-14 21:15:19','2026-10-14 21:15:19'),(3,15,'03e773de623557279b7aa7e5fea6c6068b6ae2e5606340888828e850680117ef','b507c7aff361ca65488c0a1d8903ebe1f7e622d1d7d996c146220b389f2f9b2a','[11]','2026-10-15 14:13:24','2026-10-15 14:13:24');
/*!40000 ALTER TABLE `order_idempotency_keys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `quantity` smallint(5) unsigned NOT NULL,
  `line_total` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `product_variant_id` bigint(20) unsigned DEFAULT NULL,
  `variant_label_snapshot` varchar(120) DEFAULT NULL,
  `variant_attributes_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`variant_attributes_snapshot`)),
  PRIMARY KEY (`id`),
  KEY `order_items_order_id_foreign` (`order_id`),
  KEY `order_items_product_id_index` (`product_id`),
  KEY `order_items_product_variant_id_foreign` (`product_variant_id`),
  CONSTRAINT `order_items_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL,
  CONSTRAINT `order_items_product_variant_id_foreign` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
INSERT INTO `order_items` VALUES (9,9,10,'TMC UNIFORM',200.00,1,200.00,'2026-10-14 20:54:15','2026-10-14 20:54:15',1,'Standard','{\"size\":\"LARGE\"}'),(10,10,10,'TMC UNIFORM',200.00,1,200.00,'2026-10-14 21:15:19','2026-10-14 21:15:19',1,'Standard','{\"size\":\"LARGE\"}'),(11,11,11,'48 laws',25.00,5,125.00,'2026-10-15 14:13:24','2026-10-15 14:13:24',NULL,NULL,NULL);
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_payment_methods`
--

DROP TABLE IF EXISTS `order_payment_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `order_payment_methods` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `instructions` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` smallint(5) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_payment_methods_name_unique` (`name`),
  KEY `order_payment_methods_is_active_index` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_payment_methods`
--

LOCK TABLES `order_payment_methods` WRITE;
/*!40000 ALTER TABLE `order_payment_methods` DISABLE KEYS */;
INSERT INTO `order_payment_methods` VALUES (3,'Cash on Delivery','COD manual payment.',1,0,'2026-10-14 20:48:02','2026-10-14 20:48:02');
/*!40000 ALTER TABLE `order_payment_methods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_number` varchar(32) NOT NULL,
  `buyer_id` bigint(20) unsigned DEFAULT NULL,
  `seller_id` bigint(20) unsigned DEFAULT NULL,
  `buyer_name_snapshot` varchar(255) NOT NULL,
  `seller_name_snapshot` varchar(255) NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'pending',
  `seller_response_deadline_at` timestamp NULL DEFAULT NULL,
  `needs_attention` tinyint(1) NOT NULL DEFAULT 0,
  `total_amount` decimal(10,2) NOT NULL,
  `buyer_note` text DEFAULT NULL,
  `seller_note` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `payment_method_id` bigint(20) unsigned DEFAULT NULL,
  `payment_status` varchar(50) NOT NULL DEFAULT 'unpaid',
  `payment_method_name_snapshot` varchar(100) DEFAULT NULL,
  `payment_method_instructions_snapshot` text DEFAULT NULL,
  `pickup_location_id` bigint(20) unsigned DEFAULT NULL,
  `pickup_location_name_snapshot` varchar(120) DEFAULT NULL,
  `pickup_location_area_snapshot` varchar(240) DEFAULT NULL,
  `pickup_location_details_snapshot` text DEFAULT NULL,
  `pickup_location_instructions_snapshot` text DEFAULT NULL,
  `pickup_location_hours_snapshot` varchar(120) DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `orders_order_number_unique` (`order_number`),
  KEY `orders_buyer_id_created_at_index` (`buyer_id`,`created_at`),
  KEY `orders_seller_id_created_at_index` (`seller_id`,`created_at`),
  KEY `orders_status_index` (`status`),
  KEY `orders_payment_method_id_foreign` (`payment_method_id`),
  KEY `orders_pickup_location_id_foreign` (`pickup_location_id`),
  KEY `orders_completed_at_index` (`completed_at`),
  KEY `orders_status_seller_response_deadline_at_index` (`status`,`seller_response_deadline_at`),
  CONSTRAINT `orders_buyer_id_foreign` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_payment_method_id_foreign` FOREIGN KEY (`payment_method_id`) REFERENCES `order_payment_methods` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_pickup_location_id_foreign` FOREIGN KEY (`pickup_location_id`) REFERENCES `pickup_locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_seller_id_foreign` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (9,'TMC-261015-7WJM9G0O',16,15,'Jade Pascual','Mark Anthony Pepito','completed','2026-10-16 20:54:15',0,200.00,NULL,NULL,'2026-10-14 20:54:15','2026-10-14 21:07:07',3,'unpaid','Cash on Delivery','COD manual payment.',2,'TMC Trinidad Municipal College','Expansion','215','workk',NULL,'2026-10-14 21:07:07'),(10,'TMC-261015-2UX3SUN0',16,15,'Jade Pascual','Mark Anthony Pepito','confirmed','2026-10-16 21:15:19',0,200.00,NULL,NULL,'2026-10-14 21:15:19','2026-10-15 14:30:04',3,'unpaid','Cash on Delivery','COD manual payment.',2,'TMC Trinidad Municipal College','Expansion','215','workk',NULL,NULL),(11,'TMC-261015-ZR6PWMAR',15,16,'Mark Anthony Pepito','Jade Pascual','completed','2026-10-17 14:13:24',0,125.00,NULL,NULL,'2026-10-15 14:13:24','2026-10-15 14:31:19',3,'unpaid','Cash on Delivery','COD manual payment.',2,'TMC Trinidad Municipal College','Expansion','215','workk',NULL,'2026-10-15 14:31:19');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
INSERT INTO `password_reset_tokens` VALUES ('mpepito328@gmail.com','$2y$12$s7pE9NLqn31R8O46DeC8Fe3hBJ7UctasL.N9NRD7Qc7rWnjHYUSF.','2026-10-15 02:17:46');
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) unsigned NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=211 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
INSERT INTO `personal_access_tokens` VALUES (149,'App\\Models\\User',13,'tmc-studentmart','837ef76cb0ef57f4e5e50ac4ed6ec6fa53493ac4a5df3970360cac1b76facad4','[\"*\"]','2026-10-13 23:34:55',NULL,'2026-10-13 23:34:31','2026-10-13 23:34:55'),(158,'App\\Models\\User',6,'tmc-studentmart','40f1bbdffbfb7a83441e60d34b6fa006813fe0f7cb5280a2879353d9d637ef11','[\"*\"]','2026-10-14 04:24:30',NULL,'2026-10-14 04:24:29','2026-10-14 04:24:30'),(206,'App\\Models\\User',1,'tmc-studentmart','d528b03121b78f69ad4813fa4ee42d25d327338ad49600484e337c7eaae22122','[\"*\"]','2026-10-15 13:45:02',NULL,'2026-10-15 13:44:56','2026-10-15 13:45:02'),(209,'App\\Models\\User',15,'tmc-studentmart','14f5e24251caff066e350ed3aed50c9247ddb048152df74c797be6d2603cbdaa','[\"*\"]','2026-10-15 14:30:05',NULL,'2026-10-15 14:25:55','2026-10-15 14:30:05'),(210,'App\\Models\\User',16,'tmc-studentmart','e616e7c7186be716dbca5762e0ac4a90d49718b8787f1723f78cc7d186b7a363','[\"*\"]','2026-10-15 14:31:22',NULL,'2026-10-15 14:30:52','2026-10-15 14:31:22');
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pickup_locations`
--

DROP TABLE IF EXISTS `pickup_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pickup_locations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `building_room` varchar(120) DEFAULT NULL,
  `campus_area` varchar(120) DEFAULT NULL,
  `instructions` text DEFAULT NULL,
  `operating_hours` varchar(120) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` smallint(5) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pickup_locations_is_active_index` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pickup_locations`
--

LOCK TABLES `pickup_locations` WRITE;
/*!40000 ALTER TABLE `pickup_locations` DISABLE KEYS */;
INSERT INTO `pickup_locations` VALUES (2,'TMC Trinidad Municipal College','215','Expansion','workk',NULL,1,0,'2026-10-14 20:33:43','2026-10-14 20:33:43');
/*!40000 ALTER TABLE `pickup_locations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_history_events`
--

DROP TABLE IF EXISTS `product_history_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_history_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) unsigned NOT NULL,
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `order_id` bigint(20) unsigned DEFAULT NULL,
  `event` varchar(40) NOT NULL,
  `stock_before` int(10) unsigned DEFAULT NULL,
  `stock_after` int(10) unsigned DEFAULT NULL,
  `note` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `product_variant_id` bigint(20) unsigned DEFAULT NULL,
  `variant_label_snapshot` varchar(120) DEFAULT NULL,
  `variant_attributes_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`variant_attributes_snapshot`)),
  PRIMARY KEY (`id`),
  KEY `product_history_events_actor_id_foreign` (`actor_id`),
  KEY `product_history_events_product_id_created_at_index` (`product_id`,`created_at`),
  KEY `product_history_events_order_id_event_index` (`order_id`,`event`),
  KEY `product_history_events_product_variant_id_foreign` (`product_variant_id`),
  CONSTRAINT `product_history_events_actor_id_foreign` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `product_history_events_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `product_history_events_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_history_events_product_variant_id_foreign` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_history_events`
--

LOCK TABLES `product_history_events` WRITE;
/*!40000 ALTER TABLE `product_history_events` DISABLE KEYS */;
INSERT INTO `product_history_events` VALUES (18,10,15,NULL,'listing_created',NULL,33,'Listing submitted for moderation.','2026-10-14 19:45:44','2026-10-14 19:45:44',NULL,NULL,NULL),(19,10,15,NULL,'variant_created',0,33,'Product variant created.','2026-10-14 19:45:44','2026-10-14 19:45:44',1,'Standard','{\"size\":\"LARGE\"}'),(20,10,16,9,'variant_stock_reserved',33,32,'Stock reserved for variant Standard in TMC-261015-7WJM9G0O.','2026-10-14 20:54:15','2026-10-14 20:54:15',1,'Standard','{\"size\":\"LARGE\"}'),(21,10,16,10,'variant_stock_reserved',32,31,'Stock reserved for variant Standard in TMC-261015-2UX3SUN0.','2026-10-14 21:15:19','2026-10-14 21:15:19',1,'Standard','{\"size\":\"LARGE\"}'),(22,11,16,NULL,'listing_created',NULL,90,'Listing submitted for moderation.','2026-10-14 21:17:19','2026-10-14 21:17:19',NULL,NULL,NULL),(23,10,1,NULL,'admin_archived',31,31,'Administrator archived listing from status active.','2026-10-14 21:22:35','2026-10-14 21:22:35',NULL,NULL,NULL),(24,10,1,NULL,'admin_restored',31,31,'Administrator restored listing from archived. Reopened for moderation review (moved to pending).','2026-10-14 21:25:23','2026-10-14 21:25:23',NULL,NULL,NULL),(25,10,1,NULL,'admin_archived',31,31,'Administrator archived listing from status active.','2026-10-14 21:26:37','2026-10-14 21:26:37',NULL,NULL,NULL),(26,10,1,NULL,'admin_restored',31,31,'Administrator restored listing from archived. Reopened for moderation review (moved to pending).','2026-10-15 04:48:01','2026-10-15 04:48:01',NULL,NULL,NULL),(27,11,15,11,'stock_reserved',90,85,'Stock reserved for TMC-261015-ZR6PWMAR.','2026-10-15 14:13:24','2026-10-15 14:13:24',NULL,NULL,NULL);
/*!40000 ALTER TABLE `product_history_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_images`
--

DROP TABLE IF EXISTS `product_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_images` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) unsigned NOT NULL,
  `path` varchar(255) NOT NULL,
  `sort_order` smallint(5) unsigned NOT NULL DEFAULT 0,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_images_product_id_sort_order_index` (`product_id`,`sort_order`),
  CONSTRAINT `product_images_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_images`
--

LOCK TABLES `product_images` WRITE;
/*!40000 ALTER TABLE `product_images` DISABLE KEYS */;
INSERT INTO `product_images` VALUES (11,10,'products/xT8c8NLctyqHvm2fUhVEfJxDSjMVG4POOwNbWv6g.jpg',0,1,'2026-10-14 19:45:44','2026-10-14 19:45:44'),(12,11,'products/B1lvgPCxsimRyw5ct9VKgV1pHUT3m2dmvaRH9Keg.png',0,1,'2026-10-14 21:17:19','2026-10-14 21:17:19');
/*!40000 ALTER TABLE `product_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_moderation_events`
--

DROP TABLE IF EXISTS `product_moderation_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_moderation_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) unsigned NOT NULL,
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `from_status` varchar(30) DEFAULT NULL,
  `to_status` varchar(30) NOT NULL,
  `reason` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_moderation_events_actor_id_foreign` (`actor_id`),
  KEY `product_moderation_events_product_id_created_at_index` (`product_id`,`created_at`),
  CONSTRAINT `product_moderation_events_actor_id_foreign` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `product_moderation_events_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_moderation_events`
--

LOCK TABLES `product_moderation_events` WRITE;
/*!40000 ALTER TABLE `product_moderation_events` DISABLE KEYS */;
INSERT INTO `product_moderation_events` VALUES (6,10,1,'pending','active',NULL,'2026-10-14 19:48:04','2026-10-14 19:48:04'),(7,11,1,'pending','active',NULL,'2026-10-14 21:17:50','2026-10-14 21:17:50'),(8,10,1,'pending','active',NULL,'2026-10-14 21:26:01','2026-10-14 21:26:01'),(9,10,1,'pending','active',NULL,'2026-10-15 04:48:16','2026-10-15 04:48:16');
/*!40000 ALTER TABLE `product_moderation_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_variants`
--

DROP TABLE IF EXISTS `product_variants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_variants` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) unsigned NOT NULL,
  `label` varchar(120) NOT NULL,
  `attributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attributes`)),
  `stock_quantity` int(10) unsigned NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_variants_product_id_label_index` (`product_id`,`label`),
  KEY `product_variants_product_id_is_active_stock_quantity_index` (`product_id`,`is_active`,`stock_quantity`),
  KEY `product_variants_is_active_index` (`is_active`),
  CONSTRAINT `product_variants_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_variants`
--

LOCK TABLES `product_variants` WRITE;
/*!40000 ALTER TABLE `product_variants` DISABLE KEYS */;
INSERT INTO `product_variants` VALUES (1,10,'Standard','{\"size\":\"LARGE\"}',31,1,'2026-10-14 19:45:44','2026-10-14 21:15:19');
/*!40000 ALTER TABLE `product_variants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_warnings`
--

DROP TABLE IF EXISTS `product_warnings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_warnings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) unsigned NOT NULL,
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `complaint_id` bigint(20) unsigned DEFAULT NULL,
  `reason` text NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_warnings_actor_id_foreign` (`actor_id`),
  KEY `product_warnings_product_id_created_at_index` (`product_id`,`created_at`),
  KEY `product_warnings_complaint_id_created_at_index` (`complaint_id`,`created_at`),
  CONSTRAINT `product_warnings_actor_id_foreign` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `product_warnings_complaint_id_foreign` FOREIGN KEY (`complaint_id`) REFERENCES `complaints` (`id`) ON DELETE SET NULL,
  CONSTRAINT `product_warnings_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_warnings`
--

LOCK TABLES `product_warnings` WRITE;
/*!40000 ALTER TABLE `product_warnings` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_warnings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `products` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `category_id` bigint(20) unsigned DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `stock_quantity` int(10) unsigned NOT NULL DEFAULT 1,
  `sold_out_at` timestamp NULL DEFAULT NULL,
  `archived_at` timestamp NULL DEFAULT NULL,
  `attributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attributes`)),
  PRIMARY KEY (`id`),
  KEY `products_category_id_foreign` (`category_id`),
  KEY `products_status_sold_out_at_index` (`status`,`sold_out_at`),
  KEY `products_user_id_foreign` (`user_id`),
  CONSTRAINT `products_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  CONSTRAINT `products_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (10,15,'TMC UNIFORM','2026-10-14 19:45:44','2026-10-15 04:48:16','FOR SALE',200.00,'UNIFORM',6,'products/xT8c8NLctyqHvm2fUhVEfJxDSjMVG4POOwNbWv6g.jpg','active',31,NULL,'2026-10-14 21:26:37',NULL),(11,16,'48 laws','2026-10-14 21:17:19','2026-10-15 14:13:24','khkhhuikj',25.00,'BOOK',7,'products/B1lvgPCxsimRyw5ct9VKgV1pHUT3m2dmvaRH9Keg.png','active',85,NULL,NULL,'{\"author\":\"James lid\"}');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES ('5oeLUdTchRnjzWsQoDTl6P4m0gyIL4MwP7RQsHi5',NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.129.1 Chrome/148.0.7778.280 Electron/42.6.0 Safari/537.36','eyJfdG9rZW4iOiJyVHBrTVdPb1E1Y2ZleVZyd3JxM2NFRHc1RUFlMjhkbFJEeDd3QzhSIiwiX3ByZXZpb3VzIjp7InVybCI6Imh0dHA6XC9cLzEyNy4wLjAuMTo4MDAwIiwicm91dGUiOm51bGx9LCJfZmxhc2giOnsib2xkIjpbXSwibmV3IjpbXX19',1792057201),('5uditpCzGcwiIDmdn6POn0Vgabhapjqrfk8i0dz7',NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.129.1 Chrome/148.0.7778.280 Electron/42.6.0 Safari/537.36','eyJfdG9rZW4iOiJKeXptUFBxNVJqaDJGMnpvOEJpVEJVZ2JjN2RUZHdRT3dtSkl3ckIxIiwiX3ByZXZpb3VzIjp7InVybCI6Imh0dHA6XC9cLzEyNy4wLjAuMTo4MDAwIiwicm91dGUiOm51bGx9LCJfZmxhc2giOnsib2xkIjpbXSwibmV3IjpbXX19',1792097929),('bYMfttWWa6teCZCCflrgMVaujI6oEvw9MDJihTAy',NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.129.1 Chrome/148.0.7778.280 Electron/42.6.0 Safari/537.36','eyJfdG9rZW4iOiJ1OGpza1Y3WkFiVzMxakVJOThWUzE0SkJWUTBkcktQREdwRmxPMHhlIiwiX3ByZXZpb3VzIjp7InVybCI6Imh0dHA6XC9cLzEyNy4wLjAuMTo4MDAwIiwicm91dGUiOm51bGx9LCJfZmxhc2giOnsib2xkIjpbXSwibmV3IjpbXX19',1791981374),('fmIpsSNiqVN5bKq2FXUamku1Ojar5MV2QV9uqHhC',NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0','eyJfdG9rZW4iOiJHM1lCMDZ1UDA2U0hFSW1PRlRSNkV0ZkJvdVZLZk44YUp1N0RneU1kIiwiX3ByZXZpb3VzIjp7InVybCI6Imh0dHA6XC9cL2xvY2FsaG9zdDo4MDAwIiwicm91dGUiOm51bGx9LCJfZmxhc2giOnsib2xkIjpbXSwibmV3IjpbXX19',1792078764),('wmet3kYWaKKqy57cNew1BHeJuWPDGXxuznYqGtaZ',NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0','eyJfdG9rZW4iOiJncFNjVXVrQkx4cUFrWHY1dWxIdWRmVjlBRlF1N0x5dlMyTURBZk14IiwiX3ByZXZpb3VzIjp7InVybCI6Imh0dHA6XC9cL2xvY2FsaG9zdDo4MDAwIiwicm91dGUiOm51bGx9LCJfZmxhc2giOnsib2xkIjpbXSwibmV3IjpbXX19',1792058319),('YhB1Puz5mlSg9wQhi8bxdmcCN4ilB4YnDI85FkW2',NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.129.1 Chrome/148.0.7778.280 Electron/42.6.0 Safari/537.36','eyJfdG9rZW4iOiJiSkFjWUFzT0tkbG8wRkY4bnlBczhPSlF1Q3Voa0FxZjBVcG56U1lPIiwiX3ByZXZpb3VzIjp7InVybCI6Imh0dHA6XC9cLzEyNy4wLjAuMTo4MDAwIiwicm91dGUiOm51bGx9LCJfZmxhc2giOnsib2xkIjpbXSwibmV3IjpbXX19',1792036878),('zli7BPuF4mEgdELMMT9amMlx8jDrj8SbJQf5otb0',NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.129.1 Chrome/148.0.7778.280 Electron/42.6.0 Safari/537.36','eyJfdG9rZW4iOiJjVVM1UjQ3SWxqMHk5WHJUemRlY2JxaVVXWmpPRkZ1Y093dW5kRnRpIiwiX3ByZXZpb3VzIjp7InVybCI6Imh0dHA6XC9cLzEyNy4wLjAuMTo4MDAwIiwicm91dGUiOm51bGx9LCJfZmxhc2giOnsib2xkIjpbXSwibmV3IjpbXX19',1791985997),('zSxF5RFzFLINvpwJeQpUBuBbKN95a9jKrkLXaM9d',NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-PH) PowerShell/7.6.5','eyJfdG9rZW4iOiJSeEMwbzNkMnl3dUQ1WlZkVWg1a3A3M0hqbkxQa05YaWVxd1Nqckp4IiwiX3ByZXZpb3VzIjp7InVybCI6Imh0dHA6XC9cLzEyNy4wLjAuMTo4MDE3Iiwicm91dGUiOm51bGx9LCJfZmxhc2giOnsib2xkIjpbXSwibmV3IjpbXX19',1792094976);
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `staff_application_events`
--

DROP TABLE IF EXISTS `staff_application_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff_application_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `staff_profile_id` bigint(20) unsigned NOT NULL,
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `event` varchar(40) NOT NULL,
  `from_status` varchar(30) DEFAULT NULL,
  `to_status` varchar(30) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `staff_application_events_actor_id_foreign` (`actor_id`),
  KEY `staff_application_events_staff_profile_id_created_at_index` (`staff_profile_id`,`created_at`),
  CONSTRAINT `staff_application_events_actor_id_foreign` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `staff_application_events_staff_profile_id_foreign` FOREIGN KEY (`staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff_application_events`
--

LOCK TABLES `staff_application_events` WRITE;
/*!40000 ALTER TABLE `staff_application_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `staff_application_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `staff_profiles`
--

DROP TABLE IF EXISTS `staff_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff_profiles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `first_name` varchar(255) DEFAULT NULL,
  `middle_name` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `suffix` varchar(30) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `employee_id` varchar(255) DEFAULT NULL,
  `department` varchar(10) DEFAULT NULL,
  `position` varchar(255) DEFAULT NULL,
  `employment_status` varchar(30) DEFAULT NULL,
  `employment_start_date` date DEFAULT NULL,
  `campus` varchar(255) DEFAULT NULL,
  `verification_document_path` text DEFAULT NULL,
  `application_reference_hash` varchar(64) DEFAULT NULL,
  `permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`permissions`)),
  `is_admin_created` tinyint(1) NOT NULL DEFAULT 0,
  `reviewed_by` bigint(20) unsigned DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `decision_reason` text DEFAULT NULL,
  `archived_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `staff_profiles_user_id_unique` (`user_id`),
  UNIQUE KEY `staff_profiles_employee_id_unique` (`employee_id`),
  UNIQUE KEY `staff_profiles_application_reference_hash_unique` (`application_reference_hash`),
  KEY `staff_profiles_reviewed_by_foreign` (`reviewed_by`),
  KEY `staff_profiles_department_index` (`department`),
  KEY `staff_profiles_employment_status_index` (`employment_status`),
  KEY `staff_profiles_archived_at_index` (`archived_at`),
  CONSTRAINT `staff_profiles_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `staff_profiles_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff_profiles`
--

LOCK TABLES `staff_profiles` WRITE;
/*!40000 ALTER TABLE `staff_profiles` DISABLE KEYS */;
/*!40000 ALTER TABLE `staff_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `student_id` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `contact_number` varchar(255) DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(255) NOT NULL DEFAULT 'student',
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `profile_picture` varchar(255) DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `course` varchar(10) DEFAULT NULL,
  `facebook_url` varchar(2048) DEFAULT NULL,
  `instagram_url` varchar(2048) DEFAULT NULL,
  `tiktok_url` varchar(2048) DEFAULT NULL,
  `share_contact_info` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `users_student_id_unique` (`student_id`),
  KEY `users_course_index` (`course`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'TMC Administrator','ADMIN-001','admin@tmcstudentmart.com','09157934724',NULL,'$2y$12$vhury.7Ags8/RrwfBZYSmO6/xjKpgTFxht4EBTGA4zUHDgtQkd57G','admin','active','profile-pictures/EKWsizAW1N94bB1KhVVEsaVJG25y4S4vJlhuORXD.jpg',NULL,'2026-09-23 03:10:25','2026-10-11 22:38:57',NULL,NULL,NULL,NULL,0),(15,'Mark Anthony Pepito','24-021187','mpepito328@gmail.com','09157934724',NULL,'$2y$12$cOW7uaDihipihVuzKVhd7eWIWE8bson82DMg5YYnpqA8s3PU0LLc2','student','active',NULL,NULL,'2026-10-14 05:11:08','2026-10-14 05:11:08','BSIT',NULL,NULL,NULL,0),(16,'Jade Pascual','24-021188','pascual@gmail.com','09876543210',NULL,'$2y$12$tf.QV/qMXlGLE32zV5k1S.0eQZAxwc/Szm9uZXhrgLi2MEFbIgJbG','student','active',NULL,NULL,'2026-10-14 19:47:06','2026-10-14 19:47:06','CAS',NULL,NULL,NULL,0);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'student_marketplace'
--

--
-- Dumping routines for database 'student_marketplace'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-16  6:34:36
