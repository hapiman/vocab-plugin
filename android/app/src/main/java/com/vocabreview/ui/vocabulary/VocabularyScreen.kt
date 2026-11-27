package com.vocabreview.ui.vocabulary

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vocabreview.ui.components.EmptyState
import com.vocabreview.ui.theme.Spacing

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VocabularyScreen(
    mode: String,
    onWordClick: (String) -> Unit,
    onNavigateMastered: () -> Unit,
    viewModel: VocabularyViewModel = viewModel()
) {
    val words by viewModel.words.collectAsStateWithLifecycle()
    val filteredWords = viewModel.filteredWords(mode)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (mode == "mastered") "Mastered" else "Vocabulary") },
                actions = {
                    if (mode == "learning") {
                        TextButton(onClick = onNavigateMastered) {
                            Text("Mastered")
                        }
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Search bar
            OutlinedTextField(
                value = viewModel.searchQuery,
                onValueChange = { viewModel.updateSearch(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.lg, vertical = Spacing.sm),
                placeholder = { Text("Search words or definitions...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true,
                shape = MaterialTheme.shapes.medium
            )

            if (filteredWords.isEmpty()) {
                EmptyState(
                    icon = Icons.Default.Book,
                    title = if (viewModel.searchQuery.isNotBlank()) "No Matching Words" else "No Words Yet",
                    message = if (viewModel.searchQuery.isNotBlank()) "Try a different search term."
                    else "Browse English web pages and click words to save them to your vocabulary."
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = Spacing.lg, vertical = Spacing.sm),
                    verticalArrangement = Arrangement.spacedBy(Spacing.sm)
                ) {
                    itemsIndexed(
                        items = filteredWords,
                        key = { _, item -> item.first }
                    ) { index, (word, vocabWord) ->
                        val dismissState = rememberSwipeToDismissBoxState(
                            confirmValueChange = { value ->
                                if (value == SwipeToDismissBoxValue.EndToStart && mode == "mastered") {
                                    viewModel.deleteWord(word)
                                    true
                                } else false
                            }
                        )

                        if (mode == "mastered") {
                            SwipeToDismissBox(
                                state = dismissState,
                                backgroundContent = {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .padding(horizontal = Spacing.lg),
                                        contentAlignment = androidx.compose.ui.Alignment.CenterEnd
                                    ) {
                                        Text(
                                            "Delete",
                                            color = MaterialTheme.colorScheme.error
                                        )
                                    }
                                },
                                enableDismissFromStartToEnd = false
                            ) {
                                WordListItem(
                                    index = index + 1,
                                    word = word,
                                    vocabWord = vocabWord,
                                    onClick = { onWordClick(word) }
                                )
                            }
                        } else {
                            WordListItem(
                                index = index + 1,
                                word = word,
                                vocabWord = vocabWord,
                                onClick = { onWordClick(word) }
                            )
                        }
                    }
                }
            }
        }
    }
}
