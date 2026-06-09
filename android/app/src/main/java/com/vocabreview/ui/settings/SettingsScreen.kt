package com.vocabreview.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Key
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vocabreview.ui.components.GradientButton
import com.vocabreview.ui.components.SecondaryButton
import com.vocabreview.ui.theme.AppColors
import com.vocabreview.ui.theme.Radius
import com.vocabreview.ui.theme.Spacing

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel = viewModel()
) {
    Scaffold(
        topBar = {
            TopAppBar(title = { Text("设置") })
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.xl, vertical = Spacing.lg)
        ) {
            Text(
                text = "GitHub 同步设置",
                style = MaterialTheme.typography.headlineLarge
            )

            Spacer(Modifier.height(Spacing.xxl))

            // Credential card
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radius.large))
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(Spacing.xl)
            ) {
                OutlinedTextField(
                    value = viewModel.token,
                    onValueChange = { viewModel.updateToken(it) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("GitHub Token") },
                    leadingIcon = { Icon(Icons.Default.Key, contentDescription = null) },
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    singleLine = true
                )

                Spacer(Modifier.height(Spacing.lg))

                OutlinedTextField(
                    value = viewModel.gistId,
                    onValueChange = { viewModel.updateGistId(it) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Gist ID 或 URL") },
                    leadingIcon = { Icon(Icons.Default.Description, contentDescription = null) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    singleLine = true
                )
            }

            Spacer(Modifier.height(Spacing.xxl))

            GradientButton(
                text = "保存设置",
                onClick = { viewModel.save() }
            )

            Spacer(Modifier.height(Spacing.md))

            SecondaryButton(
                text = if (viewModel.isLoading) "拉取中..." else "从 Gist 拉取",
                onClick = { viewModel.pullFromGist() },
                enabled = !viewModel.isLoading
            )

            // Status message
            viewModel.statusMessage?.let { msg ->
                Spacer(Modifier.height(Spacing.lg))
                Text(
                    text = msg,
                    fontSize = 14.sp,
                    color = if (viewModel.isError) MaterialTheme.colorScheme.error
                    else AppColors.StatMastered
                )
            }
        }
    }
}
