USE seplan_captura;

DROP TRIGGER IF EXISTS trigger_after_update_narrative_capture;

DROP TRIGGER IF EXISTS copia_ppa_final;

DELIMITER / /

-- Trigger 1: trigger_after_update_narrative_capture
CREATE TRIGGER trigger_after_update_narrative_capture 
AFTER UPDATE ON narrative_captures 
FOR EACH ROW 
BEGIN
    IF NEW.status = 'approved secont' AND (OLD.status != 'approved secont' OR OLD.status IS NULL) THEN
        SET @id_ppa = NEW.id;

        INSERT INTO narrative_captures_second_final (
            id, sequence_number, narrative_period_id, dependency_id, 
            narrative_title_id, narrative_theme_id, narrative_sub_theme_id, `order`, 
            ppa_name, new_ppa_name, ppas_type_id, investment_amount, 
            beneficiaries, narrative_beneficiary_type_id, budget_program_id, 
            custom_budget_program, locations, peds, status, observations, 
            narrative_breakdown, highlighted, created_by, edited_by, 
            deleted_at, created_at, updated_at
        ) 
        VALUES (
            NEW.id, NEW.sequence_number, NEW.narrative_period_id, NEW.dependency_id, 
            NEW.narrative_title_id, NEW.narrative_theme_id, NEW.narrative_sub_theme_id, NEW.`order`, 
            NEW.ppa_name, NEW.new_ppa_name, NEW.ppas_type_id, NEW.investment_amount, 
            NEW.beneficiaries, NEW.narrative_beneficiary_type_id, NEW.budget_program_id, 
            NEW.custom_budget_program, NEW.locations, NEW.peds, NEW.status, NEW.observations, 
            NEW.narrative_breakdown, NEW.highlighted, NEW.created_by, NEW.edited_by, 
            NEW.deleted_at, NEW.created_at, NEW.updated_at
        );

        -- Excluded non-existent entity_linkage_narrative_second_final

        INSERT INTO miss_obj_stra_act_narrative_second_final (mission_id,objective_id,narrative_strategy_id,action_line_id,narrative_capture_id) 
        SELECT mission_id, objective_id, narrative_strategy_id, action_line_id, narrative_capture_id FROM miss_obj_stra_act_narrative 
        WHERE narrative_capture_id = @id_ppa;

        INSERT INTO municipality_locality_narrative_second_final (municipality_id, locality_id, narrative_capture_id) 
        SELECT municipality_id, locality_id, narrative_capture_id FROM municipality_locality_narrative 
        WHERE narrative_capture_id = @id_ppa;

        INSERT INTO ods_linkage_narrative_second_final (ods_linkage_id, narrative_capture_id) 
        SELECT ods_linkage_id, narrative_capture_id FROM ods_linkage_narrative 
        WHERE narrative_capture_id = @id_ppa;

    END IF;
END;
//

-- Trigger 2: copia_ppa_final
CREATE TRIGGER copia_ppa_final AFTER UPDATE ON narrative_captures FOR EACH ROW BEGIN
		
	IF NEW.status = 'approved secont' THEN
		
		set @id_ppa = NEW.id;
		set @etapa = NEW.stage;
		
		
		IF (@etapa=1) THEN


			IF (select count(*) as tot from narrative_captures_first_final where id = @id_ppa) = 0 THEN

				INSERT INTO narrative_captures_first_final (id,sequence_number,narrative_period_id,dependency_id,narrative_title_id,narrative_theme_id,narrative_sub_theme_id,	`order`,ppa_name,new_ppa_name,ppas_type_id,investment_amount,beneficiaries,narrative_beneficiary_type_id,budget_program_id,locations,peds,`status`,observations,narrative_breakdown,highlighted, created_by,	edited_by,	deleted_at,	created_at,	updated_at)
				SELECT id,sequence_number,narrative_period_id,dependency_id,narrative_title_id,narrative_theme_id,narrative_sub_theme_id,	`order`,ppa_name,new_ppa_name,ppas_type_id,investment_amount,beneficiaries,narrative_beneficiary_type_id,budget_program_id,locations,peds,`status`,observations,narrative_breakdown,highlighted, created_by,	edited_by,	deleted_at,	created_at,	updated_at from narrative_captures where id = @id_ppa; 

				INSERT INTO miss_obj_stra_act_narrative_first_final (mission_id,objective_id,narrative_strategy_id,action_line_id,narrative_capture_id) SELECT * from miss_obj_stra_act_narrative where narrative_capture_id = @id_ppa;

				INSERT INTO municipality_locality_narrative_first_final (municipality_id, locality_id, narrative_capture_id) SELECT * from municipality_locality_narrative where narrative_capture_id = @id_ppa;

				INSERT INTO ods_linkage_narrative_first_final (ods_linkage_id, narrative_capture_id) SELECT * from ods_linkage_narrative where narrative_capture_id = @id_ppa;

				INSERT INTO narrative_capture_status_histories (narrative_capture_id, status, observations, created_by, created_at, updated_at) values (@id_ppa, 'En espera de actualización', 'Puesto en espera de actualización por sistema', 1, DATE_ADD(NOW(), INTERVAL 1 MINUTE), DATE_ADD(NOW(), INTERVAL 1 MINUTE));


			END IF; 
										
		ELSEIF (@etapa=2) THEN

			IF (select count(*) as tot from narrative_captures_second_final where id = @id_ppa) = 0 THEN

				INSERT INTO narrative_captures_second_final (id,sequence_number,narrative_period_id,dependency_id,narrative_title_id,narrative_theme_id,narrative_sub_theme_id,	`order`,ppa_name,new_ppa_name,ppas_type_id,investment_amount,beneficiaries,narrative_beneficiary_type_id,budget_program_id,locations,peds,`status`,observations,narrative_breakdown,highlighted, created_by,	edited_by,	deleted_at,	created_at,	updated_at)
				SELECT id,sequence_number,narrative_period_id,dependency_id,narrative_title_id,narrative_theme_id,narrative_sub_theme_id,	`order`,ppa_name,new_ppa_name,ppas_type_id,investment_amount,beneficiaries,narrative_beneficiary_type_id,budget_program_id,locations,peds,`status`,observations,narrative_breakdown,highlighted, created_by,	edited_by,	deleted_at,	created_at,	updated_at from narrative_captures where id = @id_ppa; 

				INSERT INTO miss_obj_stra_act_narrative_second_final (mission_id,objective_id,narrative_strategy_id,action_line_id,narrative_capture_id) SELECT * from miss_obj_stra_act_narrative where narrative_capture_id = @id_ppa;

				INSERT INTO municipality_locality_narrative_second_final (municipality_id, locality_id, narrative_capture_id) SELECT * from municipality_locality_narrative where narrative_capture_id = @id_ppa;

				INSERT INTO ods_linkage_narrative_second_final (ods_linkage_id, narrative_capture_id) SELECT * from ods_linkage_narrative where narrative_capture_id = @id_ppa;


			END IF; 
							
					
		END IF; 
								
	END IF;	
    
END;
//

DELIMITER;